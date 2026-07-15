import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionalSessionGuard } from '../../auth/session/optional-session.guard';
import { AppConfigController } from '../app-config.controller';
import { AppConfigService } from '../app-config.service';

const ASR_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: true },
  config: {
    asrModelId: 'whisper-1',
    transcribeSizeLimitBytes: 10_485_760,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const DEFAULT_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: false },
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: 5_242_880,
    dialCoreExternalUrl: null,
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

const EXTERNAL_URL_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: false },
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: 5_242_880,
    dialCoreExternalUrl: 'https://dial.example.com',
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
};

function makeApp() {
  const mockService = {
    getClientConfig: vi.fn(),
  };
  return { mockService };
}

async function buildApp(
  mockService: ReturnType<typeof makeApp>['mockService'],
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
    controllers: [AppConfigController],
    providers: [{ provide: AppConfigService, useValue: mockService }],
  })
    .overrideGuard(OptionalSessionGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('AppConfigController (integration)', () => {
  let app: INestApplication;
  let mockService: ReturnType<typeof makeApp>['mockService'];

  beforeEach(async () => {
    ({ mockService } = makeApp());
    app = await buildApp(mockService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /v1/client-config', () => {
    it('returns 200 with ASR configured response', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.appId).toBe('chat-ui');
      expect(result.body.features.asrEnabled).toBe(true);
      expect(result.body.config.asrModelId).toBe('whisper-1');
    });

    it('returns 200 with defaults when ASR is absent', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.features.asrEnabled).toBe(false);
      expect(result.body.config.asrModelId).toBeNull();
      expect(result.body.config.transcribeSizeLimitBytes).toBe(5_242_880);
    });

    it('returns 400 when appId is missing', async () => {
      await request(app.getHttpServer()).get('/v1/client-config').expect(400);
    });

    it('returns 400 when appId is unknown', async () => {
      await request(app.getHttpServer())
        .get('/v1/client-config?appId=unknown-app')
        .expect(400);
    });

    it('response does not contain server-only keys', async () => {
      mockService.getClientConfig.mockResolvedValue(ASR_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      const body = result.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('roles');
      expect(body).not.toHaveProperty('environment');
    });

    it('returns 200 with dialCoreExternalUrl when configured', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBe(
        'https://dial.example.com',
      );
    });

    it('returns null dialCoreExternalUrl when not configured', async () => {
      mockService.getClientConfig.mockResolvedValue(DEFAULT_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(result.body.config.dialCoreExternalUrl).toBeNull();
    });

    it('never leaks the internal DIAL_CORE_URL value', async () => {
      mockService.getClientConfig.mockResolvedValue(EXTERNAL_URL_RESPONSE);

      const result = await request(app.getHttpServer())
        .get('/v1/client-config?appId=chat-ui')
        .expect(200);

      expect(JSON.stringify(result.body)).not.toContain('DIAL_CORE_URL');
    });
  });
});
