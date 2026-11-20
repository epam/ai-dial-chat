import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from '../../app-config/feature-flags/feature.guard';
import { OrgUnitCopyService } from '../org-unit-copy.service';
import { PublishController } from '../publish.controller';
import { PublishService } from '../publish.service';
import { VersionStatusesService } from '../version-statuses.service';

const TEST_USER = { sub: 'user-123', at: 'test-access-token', bucket: 'b1' };
const URL =
  '/api/v1/catalog/application/applications%2Fb1%2Fagent__1.0.0/copy-to-org-unit';

const buildApp = async (
  service: unknown,
  isFeatureEnabled = true,
): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PublishController],
    providers: [
      { provide: OrgUnitCopyService, useValue: service },
      { provide: PublishService, useValue: {} },
      { provide: VersionStatusesService, useValue: {} },
    ],
  })
    .overrideGuard(FeatureGuard)
    .useValue({
      canActivate: () => {
        if (!isFeatureEnabled) throw new ForbiddenException();
        return true;
      },
    })
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
  await app.listen(0, '127.0.0.1');
  return app;
};

describe('POST /api/v1/catalog/:entityType/:entityId/copy-to-org-unit', () => {
  let app: INestApplication;
  let service: { copyIntoOrgUnit: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      copyIntoOrgUnit: vi.fn().mockResolvedValue({
        id: 'applications/public/Acme/agent__1.0.0',
      }),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 200 with the id of the copy', async () => {
    const res = await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme' })
      .expect(200);

    expect(res.body).toEqual({ id: 'applications/public/Acme/agent__1.0.0' });
    expect(service.copyIntoOrgUnit).toHaveBeenCalledWith(
      TEST_USER.sub,
      TEST_USER.bucket,
      TEST_USER.at,
      'application',
      'applications/b1/agent__1.0.0',
      { folderPath: 'Acme' },
    );
  });

  it('accepts a valid version and forwards it', async () => {
    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme', version: '2.0' })
      .expect(200);
    expect(service.copyIntoOrgUnit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { folderPath: 'Acme', version: '2.0' },
    );
  });

  it.each(['bad version!', '../x', '', 5])(
    'returns 400 for the version %j',
    async (version) => {
      await request(app.getHttpServer())
        .post(URL)
        .send({ folderPath: 'Acme', version })
        .expect(400);
      expect(service.copyIntoOrgUnit).not.toHaveBeenCalled();
    },
  );

  it.each(['', '../escape', 'trailing/', 'a//b'])(
    'returns 400 for the folder path %j',
    async (folderPath) => {
      await request(app.getHttpServer())
        .post(URL)
        .send({ folderPath })
        .expect(400);
      expect(service.copyIntoOrgUnit).not.toHaveBeenCalled();
    },
  );

  it('returns 400 for an unknown entity type and an unknown body field', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/gadget/x/copy-to-org-unit')
      .send({ folderPath: 'Acme' })
      .expect(400);
    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme', extra: 1 })
      .expect(400);
    expect(service.copyIntoOrgUnit).not.toHaveBeenCalled();
  });

  it('returns 403 when Core refuses the write', async () => {
    service.copyIntoOrgUnit.mockRejectedValue(new ForbiddenException());
    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme' })
      .expect(403);
  });

  it('returns 403 naming the namespace an application with dependencies lacks', async () => {
    service.copyIntoOrgUnit.mockRejectedValue(
      new ForbiddenException(
        'Write access in this org unit is missing for: toolsets',
      ),
    );

    const res = await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme/Teams' })
      .expect(403);

    expect(res.body.message).toContain('toolsets');
  });

  it('returns 200 with the application id when it is copied with its dependencies', async () => {
    service.copyIntoOrgUnit.mockResolvedValue({
      id: 'applications/public/Acme/Teams/agent__1.0.0',
    });

    const res = await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme/Teams' })
      .expect(200);

    expect(res.body).toEqual({
      id: 'applications/public/Acme/Teams/agent__1.0.0',
    });
  });

  it('returns 409 when the target exists', async () => {
    service.copyIntoOrgUnit.mockRejectedValue(new ConflictException());
    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme' })
      .expect(409);
  });

  it('returns 400 for a type without an org-unit copy', async () => {
    service.copyIntoOrgUnit.mockRejectedValue(new BadRequestException());
    await request(app.getHttpServer())
      .post('/api/v1/catalog/prompt/prompts%2Fb1%2Fp/copy-to-org-unit')
      .send({ folderPath: 'Acme' })
      .expect(400);
  });

  it('returns 503 when Core is unavailable', async () => {
    service.copyIntoOrgUnit.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme' })
      .expect(503);
  });

  it('returns 403 and never copies while the orgUnitsEnabled flag is off', async () => {
    await app.close();
    app = await buildApp(service, false);

    await request(app.getHttpServer())
      .post(URL)
      .send({ folderPath: 'Acme' })
      .expect(403);
    expect(service.copyIntoOrgUnit).not.toHaveBeenCalled();
  });
});
