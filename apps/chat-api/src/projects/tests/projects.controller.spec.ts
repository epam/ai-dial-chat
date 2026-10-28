import {
  BadGatewayException,
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureKey } from '../../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { FEATURE_KEY_METADATA } from '../../app-config/feature-flags/require-feature.decorator';
import { ProjectSource } from '../dto/project-source.enum';
import { ProjectsController } from '../projects.controller';
import { ProjectsService } from '../projects.service';

const TEST_USER = {
  sub: 'user-1',
  at: 'test-access-token',
  bucket: 'test-bucket',
};

const listing = {
  items: [
    {
      id: 'projects/test-bucket/alpha',
      name: 'alpha',
      bucket: 'test-bucket',
      path: 'alpha',
      source: ProjectSource.Personal,
      updatedAt: 1791234567000,
    },
  ],
  incompleteSources: [ProjectSource.Organization],
};

const buildApp = async (
  service: { listProjects: ReturnType<typeof vi.fn> },
  isFeatureEnabled = true,
): Promise<INestApplication> => {
  const module = await Test.createTestingModule({
    controllers: [ProjectsController],
    providers: [{ provide: ProjectsService, useValue: service }],
  })
    .overrideGuard(FeatureGuard)
    .useValue({ canActivate: () => isFeatureEnabled })
    .compile();

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
  return app;
};

describe('ProjectsController (integration)', () => {
  let app: INestApplication;
  let service: { listProjects: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { listProjects: vi.fn().mockResolvedValue(listing) };
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns the project list with a no-store cache header', async () => {
    app = await buildApp(service);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .expect(200);

    expect(res.body).toEqual(listing);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(service.listProjects).toHaveBeenCalledWith(
      TEST_USER.bucket,
      TEST_USER.at,
    );
  });

  it('gates the whole controller behind FeatureGuard and projectsEnabled', () => {
    /* The HTTP tests override FeatureGuard, so this reflection check is what
     * fails if the class-level guard or its feature key is dropped. */
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toEqual([
      FeatureGuard,
    ]);
    expect(Reflect.getMetadata(FEATURE_KEY_METADATA, ProjectsController)).toBe(
      FeatureKey.ProjectsEnabled,
    );
  });

  it('rejects the request with 403 when the feature is disabled', async () => {
    app = await buildApp(service, false);

    await request(app.getHttpServer()).get('/api/v1/projects').expect(403);

    expect(service.listProjects).not.toHaveBeenCalled();
  });

  it('lists the session bucket and ignores a client-supplied bucket or path', async () => {
    app = await buildApp(service);

    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .query({ bucket: 'other-user', path: '../../etc' })
      .expect(200);

    expect(service.listProjects).toHaveBeenCalledOnce();
    expect(service.listProjects).toHaveBeenCalledWith(
      TEST_USER.bucket,
      TEST_USER.at,
    );
  });

  it.each([
    [new BadGatewayException('upstream'), 502],
    [new ServiceUnavailableException('down'), 503],
  ])('surfaces a service %s as its HTTP status', async (error, status) => {
    service.listProjects.mockRejectedValue(error);
    app = await buildApp(service);

    await request(app.getHttpServer()).get('/api/v1/projects').expect(status);
  });
});
