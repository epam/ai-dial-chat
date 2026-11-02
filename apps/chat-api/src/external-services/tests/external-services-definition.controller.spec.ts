import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsService } from '../../app-config/feature-flags/feature-flags.service';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { UserRolesService } from '../../auth/user-roles.service';
import { ExternalServiceAuthType } from '../dto/external-service.dto';
import { ExternalServicesController } from '../external-services.controller';
import { ExternalServicesService } from '../external-services.service';

const TEST_USER = { at: 'test-access-token' };
const APP_ID = 'applications%2Fbkt%2Floop__1.0.0';
const SERVICE_ID = 'teams';
const PATH = `/api/v1/external-services/${APP_ID}/${SERVICE_ID}`;

const buildApp = async (
  service: unknown,
  { featureEnabled = true }: { featureEnabled?: boolean } = {},
): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ExternalServicesController],
    providers: [
      { provide: ExternalServicesService, useValue: service },
      FeatureGuard,
      { provide: UserRolesService, useValue: { getRoles: () => [] } },
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
};

const API_KEY_SERVICE = {
  displayName: 'Teams bot',
  authSettings: {
    authenticationType: ExternalServiceAuthType.ApiKey,
    apiKeyHeader: 'X-Bot-Secret',
  },
};

describe('ExternalServicesController — PUT/DELETE (integration)', () => {
  let app: INestApplication;
  let service: {
    putExternalService: ReturnType<typeof vi.fn>;
    deleteExternalService: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      putExternalService: vi.fn().mockResolvedValue({
        displayName: 'Teams bot',
        authenticationType: ExternalServiceAuthType.ApiKey,
      }),
      deleteExternalService: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('declares a service with the decoded app id and the session token', async () => {
    app = await buildApp(service);
    const res = await request(app.getHttpServer())
      .put(PATH)
      .send(API_KEY_SERVICE)
      .expect(200);

    expect(res.body.displayName).toBe('Teams bot');
    expect(service.putExternalService).toHaveBeenCalledWith(
      'test-access-token',
      'applications/bkt/loop__1.0.0',
      SERVICE_ID,
      API_KEY_SERVICE,
    );
  });

  it('refuses a service kind that cannot be declared', async () => {
    app = await buildApp(service);
    await request(app.getHttpServer())
      .put(PATH)
      .send({
        displayName: 'x',
        authSettings: {
          authenticationType: ExternalServiceAuthType.DialNative,
        },
      })
      .expect(400);
    expect(service.putExternalService).not.toHaveBeenCalled();
  });

  it('refuses a header name that could carry a second header', async () => {
    app = await buildApp(service);
    await request(app.getHttpServer())
      .put(PATH)
      .send({
        displayName: 'x',
        authSettings: {
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKeyHeader: 'X-A\r\nX-B',
        },
      })
      .expect(400);
  });

  it('refuses fields outside the definition', async () => {
    app = await buildApp(service);
    await request(app.getHttpServer())
      .put(PATH)
      .send({ ...API_KEY_SERVICE, apiKey: 'should-not-be-here' })
      .expect(400);
  });

  it('refuses a path-traversal service id', async () => {
    app = await buildApp(service);
    await request(app.getHttpServer())
      .put(`/api/v1/external-services/${APP_ID}/..%2F..%2Fsecrets`)
      .send(API_KEY_SERVICE)
      .expect(400);
    expect(service.putExternalService).not.toHaveBeenCalled();
  });

  it('is unavailable while liveChatInteraction is off', async () => {
    app = await buildApp(service, { featureEnabled: false });
    await request(app.getHttpServer())
      .put(PATH)
      .send(API_KEY_SERVICE)
      .expect(403);
    await request(app.getHttpServer()).delete(PATH).expect(403);
  });

  it('removes a service and answers 204', async () => {
    app = await buildApp(service);
    await request(app.getHttpServer()).delete(PATH).expect(204);
    expect(service.deleteExternalService).toHaveBeenCalledWith(
      'test-access-token',
      'applications/bkt/loop__1.0.0',
      SERVICE_ID,
    );
  });
});
