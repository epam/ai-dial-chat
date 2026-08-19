import {
  BadGatewayException,
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { IsAllowedRedirectUriConstraint } from '../dto/offline-credentials.dto';
import { OfflineCredentialsController } from '../offline-credentials.controller';
import { OfflineCredentialsService } from '../offline-credentials.service';

const TEST_USER = { at: 'test-access-token' };
const AUTH_CALLBACK_BASE_URL = 'https://chat.example.com';
const ALLOWED_REDIRECT_URI = `${AUTH_CALLBACK_BASE_URL}/auth/toolset-signin`;

async function buildApp(
  service: unknown,
  {
    featureEnabled = true,
    authenticated = true,
  }: { featureEnabled?: boolean; authenticated?: boolean } = {},
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [OfflineCredentialsController],
    providers: [
      { provide: OfflineCredentialsService, useValue: service },
      IsAllowedRedirectUriConstraint,
      FeatureGuard,
      {
        provide: FeatureFlagsService,
        useValue: { isEnabled: vi.fn().mockResolvedValue(featureEnabled) },
      },
      {
        provide: ConfigService,
        useValue: {
          get: vi.fn().mockReturnValue(AUTH_CALLBACK_BASE_URL),
        },
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  useContainer(app, { fallbackOnErrors: true });
  app.use(
    (
      req: Express.Request & { user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (authenticated) req.user = TEST_USER;
      next();
    },
  );
  if (!authenticated) {
    app.use((req: Express.Request, res: Express.Response, next: () => void) =>
      req.user ? next() : res.status(401).json({ message: 'Unauthorized' }),
    );
  }
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
}

describe('OfflineCredentialsController (integration)', () => {
  let app: INestApplication;
  let service: {
    getOfflineCredentialsStatus: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getOfflineCredentialsStatus: vi.fn(),
      signIn: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/offline-credentials', () => {
    it('returns the mapped status', async () => {
      app = await buildApp(service);
      service.getOfflineCredentialsStatus.mockResolvedValue({
        available: true,
        connected: false,
      });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/offline-credentials',
      );

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.body).toEqual({ available: true, connected: false });
      expect(service.getOfflineCredentialsStatus).toHaveBeenCalledWith(
        'test-access-token',
      );
    });

    it('returns 401 when there is no session', async () => {
      app = await buildApp(service, { authenticated: false });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/offline-credentials',
      );

      expect(res.status).toBe(401);
      expect(service.getOfflineCredentialsStatus).not.toHaveBeenCalled();
    });

    it('returns 403 when scheduledTasksEnabled is disabled', async () => {
      app = await buildApp(service, { featureEnabled: false });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/offline-credentials',
      );

      expect(res.status).toBe(403);
      expect(service.getOfflineCredentialsStatus).not.toHaveBeenCalled();
    });

    it('returns 502 when the service throws a mapped bad-gateway error', async () => {
      app = await buildApp(service);
      service.getOfflineCredentialsStatus.mockRejectedValue(
        new BadGatewayException('DIAL Core returned a server error'),
      );

      const res = await request(app.getHttpServer()).get(
        '/api/v1/offline-credentials',
      );

      expect(res.status).toBe(502);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      app = await buildApp(service);
      service.getOfflineCredentialsStatus.mockRejectedValue(
        new ServiceUnavailableException('DIAL Core is unreachable'),
      );

      const res = await request(app.getHttpServer()).get(
        '/api/v1/offline-credentials',
      );

      expect(res.status).toBe(503);
    });
  });

  describe('POST /api/v1/offline-credentials/signin', () => {
    it('submits the authorization code and returns success', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({ code: 'auth-code', redirectUri: ALLOWED_REDIRECT_URI });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(service.signIn).toHaveBeenCalledWith('test-access-token', {
        code: 'auth-code',
        redirectUri: ALLOWED_REDIRECT_URI,
      });
    });

    it('rejects a missing/empty code', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({ code: '', redirectUri: ALLOWED_REDIRECT_URI });

      expect(res.status).toBe(400);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('rejects a redirectUri outside the allowlisted origin/path', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({
          code: 'auth-code',
          redirectUri: 'https://evil.example.com/auth/toolset-signin',
        });

      expect(res.status).toBe(400);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('rejects a redirectUri on the allowed origin but a disallowed path', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({
          code: 'auth-code',
          redirectUri: `${AUTH_CALLBACK_BASE_URL}/../../etc/passwd`,
        });

      expect(res.status).toBe(400);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('returns 401 when there is no session', async () => {
      app = await buildApp(service, { authenticated: false });

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({ code: 'auth-code', redirectUri: ALLOWED_REDIRECT_URI });

      expect(res.status).toBe(401);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('returns 403 when scheduledTasksEnabled is disabled', async () => {
      app = await buildApp(service, { featureEnabled: false });

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({ code: 'auth-code', redirectUri: ALLOWED_REDIRECT_URI });

      expect(res.status).toBe(403);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('returns 502 when the service reports Core failure', async () => {
      app = await buildApp(service);
      service.signIn.mockRejectedValue(
        new BadGatewayException(
          'sign in offline-credentials (Core reported failure)',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/offline-credentials/signin')
        .send({ code: 'auth-code', redirectUri: ALLOWED_REDIRECT_URI });

      expect(res.status).toBe(502);
    });
  });
});
