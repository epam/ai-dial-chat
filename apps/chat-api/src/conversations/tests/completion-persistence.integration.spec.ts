import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { AuthSource } from '../../auth/auth-source.enum';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DeploymentsService } from '../../deployments/deployments.service';
import { DialClientService } from '../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationGenerationService,
  type GenerationTerminalEvent,
} from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import { ResponsesAdapter } from '../generation/responses.adapter';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import { ConversationStreamingService } from '../streaming/conversation-streaming.service';

/*
 * Actual loopback HTTP, installed SDK, persistence, relay and Nest controller.
 * Only identity/deployment discovery and the external Core server are fixtures.
 * The synthetic Core clock can cross token expiry during the open stream;
 * no production credential, IdP or storage is contacted.
 */
describe('completion persistence over HTTP', () => {
  let app: INestApplication;
  let core: Server;
  let registry: ConversationGenerationService;
  let stored: ConversationResponseDto;
  let terminalStatus: number;
  let coreTime: number;
  let writes: { body: ConversationResponseDto; authorization?: string }[];
  let terminalEvents: GenerationTerminalEvent[];
  const tokenExpiresAt = 120;
  const payload = {
    id: 'response-1',
    choices: [
      {
        index: 0,
        delta: {
          content: 'Visible answer',
          custom_content: {
            stages: [
              {
                index: 0,
                name: 'Visible step',
                content: 'Tool output',
                status: 'completed',
              },
            ],
          },
        },
      },
    ],
  };

  beforeEach(async () => {
    terminalStatus = 200;
    coreTime = 0;
    writes = [];
    terminalEvents = [];
    stored = {
      id: 'bucket/test-path',
      folderId: 'bucket',
      name: 'Test',
      model: { id: 'model' },
      assistantModelId: 'model',
      messages: [],
      prompt: '',
      temperature: 1,
      lastActivityDate: 0,
      updatedAt: 0,
      selectedAddons: [],
      llmNamingDone: true,
    };
    core = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(Buffer.from(chunk));
      const body = Buffer.concat(buffers).toString();
      if (req.method === 'PUT') {
        writes.push({
          body: JSON.parse(body),
          authorization: req.headers.authorization,
        });
      }
      res.setHeader('Content-Type', 'application/json');
      if (
        req.headers.authorization === 'Bearer expiring-token' &&
        coreTime >= tokenExpiresAt
      ) {
        res
          .writeHead(401)
          .end(JSON.stringify({ error: { message: 'fixture token expired' } }));
        return;
      }
      if (url.pathname.includes('/chat/completions')) {
        const attachment = registry.attach('c:test-session', 'test-path');
        attachment?.emitter.on('terminal', (event: GenerationTerminalEvent) =>
          terminalEvents.push(event),
        );
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: ' + JSON.stringify(payload) + '\n\n');
        if (terminalStatus === 401) coreTime = tokenExpiresAt;
        res.end('data: [DONE]\n\n');
        return;
      }
      if (url.pathname.includes('/conversations/')) {
        if (req.method === 'GET') {
          res.end(JSON.stringify(stored));
          return;
        }
        if (req.method === 'PUT') {
          if (writes.length > 1 && terminalStatus !== 200) {
            res.writeHead(terminalStatus).end(
              JSON.stringify({
                error: { message: 'fixture storage unavailable' },
              }),
            );
            return;
          }
          stored = JSON.parse(body) as ConversationResponseDto;
          res.end(JSON.stringify(stored));
          return;
        }
      }
      res.writeHead(404).end(
        JSON.stringify({
          error: { message: 'Unexpected fixture route: ' + url.pathname },
        }),
      );
    });
    await new Promise<void>((resolve) => core.listen(0, '127.0.0.1', resolve));
    const config = new ConfigService<EnvironmentVariables>({
      DIAL_CORE_URL: `http://127.0.0.1:${(core.address() as AddressInfo).port}`,
    });
    const dial = new DialClientService(config);
    registry = new ConversationGenerationService(config);
    const persistence = new ConversationPersistenceService(dial, {
      maybeRenameAfterFirstReply: vi.fn(),
    } as never);
    const streaming = new ConversationStreamingService(
      dial,
      registry,
      persistence,
      {
        getDeploymentDetails: vi.fn().mockResolvedValue({
          modelDetails: { features: { chatCompletion: true } },
        }),
      } as unknown as DeploymentsService,
      new ResponsesAdapter(dial),
      {
        isEnabled: vi.fn().mockResolvedValue(false),
      } as unknown as FeatureFlagsService,
    );
    const module = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: {
            streamCompletion: streaming.streamCompletion.bind(streaming),
          },
        },
        { provide: ConversationGenerationService, useValue: registry },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        sid: 'test-session',
        sub: 'user',
        providerId: 'test',
        at: 'expiring-token',
        bucket: 'bucket',
        claims: {},
        csrf: 'csrf',
      };
      req.authSource = AuthSource.Cookie;
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    if (core) {
      core.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        core.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  const complete = () =>
    request(app.getHttpServer())
      .post('/conversations/completions')
      .send({
        path: 'test-path',
        model: 'model',
        message: 'question',
        mode: 'append',
        generationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      })
      .expect(200);

  it.each([401, 503])(
    'reports HTTP %i on the terminal write after delivering text and stages',
    async (status) => {
      terminalStatus = status;
      const response = await complete();
      expect(response.text).toContain('Visible answer');
      expect(response.text).toContain('Visible step');
      expect(writes).toHaveLength(2);
      expect(writes[0].body.messages.at(-1)?.content).toBe('');
      expect(writes[1].body.messages.at(-1)?.content).toBe('Visible answer');
      expect(
        writes[1].body.messages.at(-1)?.custom_content?.stages,
      ).toHaveLength(1);
      expect(writes.map((write) => write.authorization)).toEqual([
        'Bearer expiring-token',
        'Bearer expiring-token',
      ]);
      expect(stored.messages.at(-1)?.content).toBe('');
      expect(stored.messages.at(-1)?.custom_content?.stages ?? []).toEqual([]);
      expect(registry.attach('c:test-session', 'test-path')).toBeUndefined();
      expect(response.text).toContain('conversation_save_failed');
      expect(response.text).not.toContain('fixture token expired');
      expect(response.text).not.toContain('fixture storage unavailable');
      expect(terminalEvents).toEqual([
        expect.objectContaining({
          type: 'error',
          errorType: 'conversation_save_failed',
        }),
      ]);
    },
  );

  it('persists the complete answer when the terminal write succeeds', async () => {
    const response = await complete();
    expect(stored.messages.at(-1)?.content).toBe('Visible answer');
    expect(stored.messages.at(-1)?.custom_content?.stages).toHaveLength(1);
    expect(response.text).not.toContain('conversation_save_failed');
    expect(writes).toHaveLength(2);
    expect(terminalEvents).toEqual([{ type: 'done' }]);
  });
});
