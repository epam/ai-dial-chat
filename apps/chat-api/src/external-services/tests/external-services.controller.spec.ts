import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '../dto/external-service.dto';
import { ExternalServicesController } from '../external-services.controller';
import { ExternalServicesService } from '../external-services.service';

const TEST_USER = { at: 'test-access-token' };
const APP_ID = 'applications%2Fpublic%2Ffinhub-via-openapi__1.0.0';
const SERVICE_ID = 'finhub-api2';

async function buildApp(
  service: unknown,
  { featureEnabled = true }: { featureEnabled?: boolean } = {},
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ExternalServicesController],
    providers: [
      { provide: ExternalServicesService, useValue: service },
      FeatureGuard,
      {
        provide: FeatureFlagsService,
        useValue: { isEnabled: vi.fn().mockResolvedValue(featureEnabled) },
      },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.use(
    (
      req: Express.Request & { user?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      req.user = TEST_USER;
      next();
    },
  );
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

describe('ExternalServicesController (integration)', () => {
  let app: INestApplication;
  let service: {
    getExternalService: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getExternalService: vi.fn(),
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/external-services/:appId/:serviceId', () => {
    it('returns the mapped metadata', async () => {
      app = await buildApp(service);
      service.getExternalService.mockResolvedValue({
        displayName: 'FinHub API',
        description: 'Financial data lookup service',
        authenticationType: ExternalServiceAuthType.ApiKey,
      });

      const res = await request(app.getHttpServer()).get(
        `/api/v1/external-services/${APP_ID}/${SERVICE_ID}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        displayName: 'FinHub API',
        description: 'Financial data lookup service',
        authenticationType: ExternalServiceAuthType.ApiKey,
      });
      expect(service.getExternalService).toHaveBeenCalledWith(
        'test-access-token',
        decodeURIComponent(APP_ID),
        SERVICE_ID,
      );
    });

    it('returns 404 when the service is not found', async () => {
      app = await buildApp(service);
      service.getExternalService.mockRejectedValue(
        new NotFoundException('Resource not found'),
      );

      const res = await request(app.getHttpServer()).get(
        `/api/v1/external-services/${APP_ID}/${SERVICE_ID}`,
      );

      expect(res.status).toBe(404);
    });

    it('returns 400 for a serviceId with disallowed characters', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/external-services/${APP_ID}/bad service id`,
      );

      expect(res.status).toBe(400);
      expect(service.getExternalService).not.toHaveBeenCalled();
    });

    it('returns 403 when liveChatInteraction is disabled', async () => {
      app = await buildApp(service, { featureEnabled: false });

      const res = await request(app.getHttpServer()).get(
        `/api/v1/external-services/${APP_ID}/${SERVICE_ID}`,
      );

      expect(res.status).toBe(403);
      expect(service.getExternalService).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/external-services/:appId/:serviceId/signin', () => {
    it('submits API key credentials', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/${SERVICE_ID}/signin`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(service.signIn).toHaveBeenCalledWith(
        'test-access-token',
        decodeURIComponent(APP_ID),
        SERVICE_ID,
        expect.objectContaining({ apiKey: 'secret-key' }),
      );
    });

    it('rejects a body missing the required apiKey for API_KEY auth', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/${SERVICE_ID}/signin`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
        });

      expect(res.status).toBe(400);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('rejects a serviceId with disallowed characters', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/bad service id/signin`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
        });

      expect(res.status).toBe(400);
      expect(service.signIn).not.toHaveBeenCalled();
    });

    it('propagates a 502 from the service', async () => {
      app = await buildApp(service);
      service.signIn.mockRejectedValue(
        new (class extends BadRequestException {})(),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/${SERVICE_ID}/signin`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when liveChatInteraction is disabled', async () => {
      app = await buildApp(service, { featureEnabled: false });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/${SERVICE_ID}/signin`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
        });

      expect(res.status).toBe(403);
      expect(service.signIn).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/external-services/:appId/:serviceId/signout', () => {
    it('revokes credentials successfully', async () => {
      app = await buildApp(service);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/external-services/${APP_ID}/${SERVICE_ID}/signout`)
        .send({
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });
});
