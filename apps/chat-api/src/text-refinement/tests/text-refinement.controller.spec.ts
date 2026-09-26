import { EventEmitter } from 'node:events';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { AuthSource } from '../../auth/auth-source.enum';
import { CsrfGuard } from '../../auth/csrf/csrf.guard';
import { SessionGuard } from '../../auth/session/session.guard';
import { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { TextRefinementPurpose } from '../dto/refine-text.dto';
import { TextRefinementController } from '../text-refinement.controller';
import { TextRefinementService } from '../text-refinement.service';

const user = {
  at: 'caller-token',
  sub: 'author',
  providerId: 'oidc',
  bucket: 'bucket',
  claims: { roles: ['skill-author'] },
  csrf: 'csrf-token',
};
const body = {
  purpose: TextRefinementPurpose.SkillDescription,
  text: 'Original',
};

describe('Text refinement HTTP contract', () => {
  let app: INestApplication;
  let service: TextRefinementService;
  let config: ConfigService<EnvironmentVariables, true>;
  const send = vi.fn();
  const enabled = vi.fn();
  beforeEach(async () => {
    config = new ConfigService<EnvironmentVariables, true>({
      UTILITY_MODEL: 'refiner',
      CORS_ORIGIN: 'http://localhost:4207',
    });
    enabled.mockReset().mockResolvedValue(true);
    send.mockReset().mockResolvedValue({
      response: new Response(),
      data: {
        choices: [{ finish_reason: 'stop', message: { content: 'Refined' } }],
      },
    });
    const module = await Test.createTestingModule({
      controllers: [TextRefinementController],
      providers: [
        TextRefinementService,
        { provide: ConfigService, useValue: config },
        {
          provide: DialClientService,
          useValue: {
            client: { sendChatCompletionRequest: send },
            dialApiVersion: '2024-10-21',
          },
        },
        { provide: FeatureFlagsService, useValue: { isEnabled: enabled } },
      ],
    }).compile();
    service = module.get(TextRefinementService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    const reflector = new Reflector();
    app.useGlobalGuards(
      new SessionGuard(
        [
          {
            source: AuthSource.Cookie,
            supports: (req) => req.headers.cookie === 'session=test',
            authenticate: async () => user,
          },
        ],
        reflector,
      ),
      new CsrfGuard(config, reflector),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });
  const post = () =>
    request(app.getHttpServer())
      .post('/api/v1/text-refinement')
      .set('Cookie', 'session=test')
      .set('Origin', 'http://localhost:4207')
      .set('x-csrf-token', 'csrf-token');

  it('returns typed text with no-store through the versioned endpoint', async () => {
    const response = await post().send(body).expect(200);
    expect(response.body).toEqual({ text: 'Refined' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(Object.values(TextRefinementPurpose))(
    'accepts authorized %s requests',
    async (purpose) => {
      await post()
        .send({ ...body, purpose })
        .expect(200);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects a task description above 500 code points before calling DIAL', async () => {
    await post()
      .send({
        purpose: TextRefinementPurpose.ScheduledTaskDescription,
        text: 'a'.repeat(501),
      })
      .expect(400);
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { text: 'text' },
    { purpose: body.purpose },
    { ...body, purpose: 'unknown' },
    { ...body, text: null },
    { ...body, text: 42 },
    { ...body, text: ' \n' },
    { ...body, text: 'x'.repeat(4001) },
    { ...body, text: '😀'.repeat(4001) },
    { ...body, model: 'override' },
    { ...body, systemPrompt: 'override' },
    { ...body, context: 'sibling' },
  ])('rejects invalid input without calling the model: %j', async (input) => {
    await post().send(input).expect(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('accepts the Unicode code point input boundary', async () => {
    await post()
      .send({ ...body, text: '😀'.repeat(4000) })
      .expect(200);
  });
  it('rejects missing authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/text-refinement')
      .send(body)
      .expect(401);
    expect(send).not.toHaveBeenCalled();
  });
  it.each(['x-csrf-token', 'Origin'])(
    'enforces cookie session %s protection',
    async (header) => {
      await post().unset(header).send(body).expect(403);
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each([
    TextRefinementPurpose.ScheduledTaskDescription,
    TextRefinementPurpose.ScheduledTaskInstructions,
  ])(
    'denies %s for skill-only authors before invoking DIAL',
    async (purpose) => {
      enabled.mockResolvedValue(false);
      await post()
        .send({ ...body, purpose })
        .expect(403);
      expect(enabled).toHaveBeenCalledWith(FeatureKey.ScheduledTasksEnabled, {
        appId: 'chat-ui',
        userId: user.sub,
        roles: ['skill-author'],
      });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it('applies the global HTTP body limit before calling the model', async () => {
    await post()
      .send({ ...body, text: 'x'.repeat(110_000) })
      .expect(413);
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    [403, 403],
    [429, 429],
    [500, 502],
  ])('maps upstream HTTP %s to %s', async (upstream, status) => {
    send.mockResolvedValue({
      response: new globalThis.Response(null, { status: upstream }),
      error: 'sensitive body',
    });
    const response = await post().send(body).expect(status);
    expect(response.body).toMatchObject({
      statusCode: status,
      error: expect.any(String),
      message: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('sensitive');
  });
  it('returns 502 for a truncated result', async () => {
    send.mockResolvedValue({
      response: new globalThis.Response(),
      data: {
        choices: [{ finish_reason: 'length', message: { content: 'Partial' } }],
      },
    });
    await post().send(body).expect(502);
  });
  it('returns 503 when no model is configured', async () => {
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'CORS_ORIGIN' ? 'http://localhost:4207' : undefined,
    );
    await post().send(body).expect(503);
    expect(send).not.toHaveBeenCalled();
  });
  it('returns 503 for network failures', async () => {
    send.mockRejectedValue(new Error('network failure'));
    await post().send(body).expect(503);
  });
  it('aborts upstream on disconnect and releases HTTP listeners', async () => {
    const req = Object.assign(new EventEmitter(), { user });
    const res = new EventEmitter();
    let signal: AbortSignal | undefined;
    vi.spyOn(service, 'refineText').mockImplementation(
      async (_dto, _user, requestSignal) => {
        signal = requestSignal;
        return new Promise((resolve) =>
          requestSignal.addEventListener(
            'abort',
            () => resolve({ text: 'ignored' }),
            { once: true },
          ),
        );
      },
    );
    const controller = new TextRefinementController(service);
    const pending = controller.refineText(
      body,
      req as unknown as Request,
      res as unknown as Response,
    );
    res.emit('close');
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
  });
});
