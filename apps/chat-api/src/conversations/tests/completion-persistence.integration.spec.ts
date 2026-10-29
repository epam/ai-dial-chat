import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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
import { BackgroundGenerationService } from '../generation/background-generation.service';
import { ChatCompletionsAdapter } from '../generation/chat-completions.adapter';
import { CoreResponsesClient } from '../generation/core-responses.client';
import { GenerationApiSelector } from '../generation/generation-api-selector.service';
import { ResponsesAdapter } from '../generation/responses.adapter';
import { ConversationTitleCacheService } from '../listing/conversation-title-cache.service';
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
  let coreChunks: unknown[];
  let modelCalls: number;
  let holdConversationReads: boolean;
  let holdConversationWrites: boolean;
  let heldRequests: (() => void)[];
  /* Lowered only by the bounded-preparation tests, before the app is built. */
  let preparationTimeoutMs = 30_000;
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
    coreChunks = [payload];
    modelCalls = 0;
    holdConversationReads = false;
    holdConversationWrites = false;
    heldRequests = [];
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
      if (
        url.pathname.includes('/conversations/') &&
        ((req.method === 'GET' && holdConversationReads) ||
          (req.method === 'PUT' && holdConversationWrites))
      ) {
        await new Promise<void>((release) => heldRequests.push(release));
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
        modelCalls += 1;
        const attachment = registry.attach('c:test-session', 'test-path');
        attachment?.emitter.on('terminal', (event: GenerationTerminalEvent) =>
          terminalEvents.push(event),
        );
        res.setHeader('Content-Type', 'text/event-stream');
        for (const chunk of coreChunks) {
          res.write('data: ' + JSON.stringify(chunk) + '\n\n');
        }
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
      GENERATION_PREPARATION_TIMEOUT_MS: preparationTimeoutMs,
    });
    const dial = new DialClientService(config);
    registry = new ConversationGenerationService(config);
    const persistence = new ConversationPersistenceService(
      dial,
      {
        maybeRenameAfterFirstReply: vi.fn(),
      } as never,
      new ConversationTitleCacheService(),
    );
    const deployments = {
      resolveDeploymentItem: vi.fn().mockResolvedValue(null),
      getDeploymentDetails: vi.fn().mockResolvedValue({
        modelDetails: { features: { chatCompletion: true } },
      }),
    } as unknown as DeploymentsService;
    const streaming = new ConversationStreamingService(
      dial,
      registry,
      persistence,
      deployments,
      new ResponsesAdapter(dial),
      new ChatCompletionsAdapter(dial),
      new GenerationApiSelector(deployments, {
        isEnabled: vi.fn().mockResolvedValue(false),
      } as unknown as FeatureFlagsService),
      new BackgroundGenerationService(
        persistence,
        new ResponsesAdapter(dial),
        new CoreResponsesClient(dial),
        registry,
      ),
      config,
    );
    const module = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: {
            streamCompletion: streaming.streamCompletion.bind(streaming),
            resolveBackgroundAttach:
              streaming.resolveBackgroundAttach.bind(streaming),
            stopBackgroundGeneration:
              streaming.stopBackgroundGeneration.bind(streaming),
            markConversationUnviewed: vi.fn().mockResolvedValue(undefined),
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

  it.each([
    [401, 401],
    [503, 502],
  ])(
    'reports HTTP %i on the terminal write after delivering text and stages',
    async (status, reportedStatus) => {
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
      expect(response.text).toContain(`"status":${reportedStatus}`);
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

  it('persists parent references sent only on the opening delta of each sparse child', async () => {
    const stageChunk = (stages: Record<string, unknown>[], content = '') => ({
      id: 'response-1',
      choices: [{ index: 0, delta: { content, custom_content: { stages } } }],
    });
    coreChunks = [
      stageChunk([{ index: 4, name: 'Plan' }], 'Nested answer'),
      stageChunk([
        { index: 7, name: 'Search', parent_stage_index: 4 },
        { index: 9, name: 'Read', parent_stage_index: 4 },
      ]),
      stageChunk([
        { index: 7, content: 'found', status: 'completed' },
        { index: 9, status: 'failed' },
      ]),
      stageChunk([{ index: 4, status: 'completed' }]),
    ];

    const response = await complete();

    expect(response.text).toContain('"parent_stage_index":4');
    expect(terminalEvents).toEqual([{ type: 'done' }]);
    const stages = stored.messages.at(-1)?.custom_content?.stages as
      Record<string, unknown>[] | undefined;
    expect(stages).toEqual([
      { index: 4, name: 'Plan', status: 'completed' },
      {
        index: 7,
        name: 'Search',
        parent_stage_index: 4,
        content: 'found',
        status: 'completed',
      },
      { index: 9, name: 'Read', parent_stage_index: 4, status: 'failed' },
    ]);
  });

  describe('bounded preparation', () => {
    const PREPARATION_TIMEOUT_MS = 300;
    const COMPLETION_BODY = {
      path: 'test-path',
      model: 'model',
      message: 'question',
      mode: 'append',
      generationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    };

    beforeAll(() => {
      preparationTimeoutMs = PREPARATION_TIMEOUT_MS;
    });

    afterAll(() => {
      preparationTimeoutMs = 30_000;
    });

    const postCompletion = () =>
      request(app.getHttpServer())
        .post('/conversations/completions')
        .send(COMPLETION_BODY);
    /* Supertest sends lazily; awaiting inside an async helper starts the request now. */
    const startCompletion = async () => postCompletion();
    const postStop = () =>
      request(app.getHttpServer())
        .post('/conversations/completions/stop')
        .send({
          generationId: COMPLETION_BODY.generationId,
          path: 'test-path',
        });
    const postAttach = () =>
      request(app.getHttpServer())
        .post('/conversations/completions/attach')
        .send({ path: 'test-path' });
    const waitForHeldRequest = () =>
      vi.waitFor(() => expect(heldRequests).toHaveLength(1));
    const waitForKeyRelease = () =>
      vi.waitFor(() =>
        expect(
          registry.getStatus('c:test-session', 'test-path'),
        ).toBeUndefined(),
      );

    it('responds 503 with no SSE headers when the conversation read stalls', async () => {
      holdConversationReads = true;

      const response = await postCompletion();

      expect(response.status).toBe(503);
      expect(response.headers['content-type']).not.toContain(
        'text/event-stream',
      );
      expect(response.body.message).toBe('Generation preparation timed out');
      expect(writes).toHaveLength(0);
      expect(modelCalls).toBe(0);
    });

    it('ends an attach made during a stalled preparation with an error event and refuses a later attach with 404', async () => {
      holdConversationReads = true;

      const completion = startCompletion();
      await waitForHeldRequest();
      const attach = await postAttach();

      expect(attach.status).toBe(200);
      expect(attach.text).toContain('"type":"snapshot"');
      expect(attach.text).toContain('"type":"error"');
      expect((await completion).status).toBe(503);
      await postAttach().expect(404);
    });

    it('rejects a new completion with 409 until the abandoned read settles, then accepts it', async () => {
      holdConversationReads = true;

      await postCompletion().expect(503);
      await postCompletion().expect(409);

      holdConversationReads = false;
      heldRequests.forEach((release) => release());
      await waitForKeyRelease();

      const response = await postCompletion().expect(200);
      expect(response.text).toContain('Visible answer');
    });

    it('refuses Stop with 404 after preparation was abandoned', async () => {
      holdConversationReads = true;

      await postCompletion().expect(503);

      await postStop().expect(404);
    });

    it('accepts a Stop during preparation, then streams and persists a stopped answer without calling the model', async () => {
      holdConversationReads = true;

      const completion = startCompletion();
      await waitForHeldRequest();
      await postStop().expect(204);
      holdConversationReads = false;
      heldRequests.forEach((release) => release());
      const response = await completion;

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(modelCalls).toBe(0);
      expect(writes).toHaveLength(2);
      /* The stop marker is a stored-message field the response DTO does not declare. */
      const stoppedMessage = writes[1].body.messages.at(-1) as
        Record<string, unknown> | undefined;
      expect(stoppedMessage?.wasStoppedByUser).toBe(true);
      expect(stoppedMessage?.streamErrorMessage).toBeUndefined();
    });

    it('makes the abandoned start-state save the only write, with no terminal save after it settles', async () => {
      holdConversationWrites = true;

      await postCompletion().expect(503);
      expect(writes).toHaveLength(1);

      heldRequests.forEach((release) => release());
      await waitForKeyRelease();

      expect(writes).toHaveLength(1);
      expect(writes[0].body.messages.at(-1)?.content).toBe('');
      expect(modelCalls).toBe(0);
    });
  });
});
