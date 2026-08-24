import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { UnpublishResultDto } from '../dto/unpublish-result.dto';
import { PublishController } from '../publish.controller';
import { PublishService } from '../publish.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'bucket-123',
  claims: { name: 'Test User' },
};

const unpublishResult: UnpublishResultDto = {
  entityId: 'tool-abc123',
  entityType: CatalogEntityType.Toolset,
  folderPath: 'Organization/Data Science',
  version: '1.2.0',
  requestedAt: '2026-08-13T10:00:00.000Z',
  requestedBy: 'user@example.com',
};

const buildApp = async (service: unknown): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PublishController],
    providers: [{ provide: PublishService, useValue: service }],
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

describe('PublishController — POST /api/v1/catalog/:entityType/:entityId/unpublish', () => {
  let app: INestApplication;
  let service: {
    publish: ReturnType<typeof vi.fn>;
    unpublish: ReturnType<typeof vi.fn>;
    getPublishHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn(),
      unpublish: vi.fn().mockResolvedValue(unpublishResult),
      getPublishHistory: vi.fn().mockResolvedValue([]),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('delegates to the service and returns 200 with the unpublish result', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: 'Organization/Data Science', version: '1.2.0' })
      .expect(200);

    expect(res.body).toEqual(unpublishResult);
    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'toolset',
      'tool-abc123',
      'Organization/Data Science',
      '1.2.0',
      'Test User',
    );
  });

  it('passes an omitted version through as undefined', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/prompt/Work%2FAI%2Fsummarize/unpublish')
      .send({ folderPath: 'Organization/Prompts' })
      .expect(200);

    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'prompt',
      'Work/AI/summarize',
      'Organization/Prompts',
      undefined,
      'Test User',
    );
  });

  it('accepts an empty folderPath, targeting the public root', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: '' })
      .expect(200);

    expect(service.unpublish).toHaveBeenCalledWith(
      TEST_USER.at,
      TEST_USER.bucket,
      'toolset',
      'tool-abc123',
      '',
      undefined,
      'Test User',
    );
  });

  it('rejects a path-traversal folderPath with 400 before reaching the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: '../../etc/passwd' })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  it('rejects a rules array with 400, since unpublish must never forward rules', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: 'Organization', rules: [] })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  it('rejects an unknown entityType with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog/notAnEntity/tool-abc123/unpublish')
      .send({ folderPath: 'Organization' })
      .expect(400);

    expect(service.unpublish).not.toHaveBeenCalled();
  });

  it('surfaces a service ForbiddenException as 403', async () => {
    service.unpublish.mockRejectedValue(
      new ForbiddenException('No write access to the target folder'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: 'Organization/Data Science' })
      .expect(403);
  });

  it('surfaces a service NotFoundException as 404', async () => {
    service.unpublish.mockRejectedValue(
      new NotFoundException('Unknown target'),
    );

    await request(app.getHttpServer())
      .post('/api/v1/catalog/toolset/tool-abc123/unpublish')
      .send({ folderPath: 'Organization/Data Science' })
      .expect(404);
  });
});
