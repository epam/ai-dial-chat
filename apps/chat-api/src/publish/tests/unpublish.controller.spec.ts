import {
  BadGatewayException,
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
    canUnpublish: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn(),
      unpublish: vi.fn().mockResolvedValue(unpublishResult),
      getPublishHistory: vi.fn().mockResolvedValue([]),
      canUnpublish: vi.fn().mockResolvedValue(true),
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
      TEST_USER,
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
      TEST_USER,
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
      TEST_USER,
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

describe('PublishController — unpublish ownership', () => {
  let app: INestApplication;
  const service = {
    unpublish: vi.fn(),
    canUnpublish: vi.fn(),
  };

  beforeEach(async () => {
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 403 when a non-owner, non-admin asks to unpublish', async () => {
    service.unpublish.mockRejectedValue(
      new ForbiddenException('You can only unpublish resources you published'),
    );

    const res = await request(app.getHttpServer())
      .post(
        '/api/v1/catalog/toolset/toolsets%2Fpublic%2FTeam%2Ftool__1.0.0/unpublish',
      )
      .send({ folderPath: 'Team' })
      .expect(403);

    expect(res.body.message).toBe(
      'You can only unpublish resources you published',
    );
  });

  it('reports that the publisher may unpublish their copy', async () => {
    service.canUnpublish.mockResolvedValue(true);

    const res = await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/toolset/toolsets%2Fpublic%2FTeam%2Ftool__1.0.0/unpublish-access',
      )
      .expect(200);

    expect(res.body).toEqual({ canUnpublish: true });
    expect(service.canUnpublish).toHaveBeenCalledWith(
      TEST_USER,
      'toolset',
      'toolsets/public/Team/tool__1.0.0',
    );
  });

  it('reports a refusal as a 200 answer, not an error', async () => {
    service.canUnpublish.mockResolvedValue(false);

    const res = await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/toolset/toolsets%2Fpublic%2FTeam%2Ftool__1.0.0/unpublish-access',
      )
      .expect(200);

    expect(res.body).toEqual({ canUnpublish: false });
  });

  it('rejects an unknown entityType with 400 before checking access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/notAnEntity/tool-abc123/unpublish-access')
      .expect(400);

    expect(service.canUnpublish).not.toHaveBeenCalled();
  });

  it('surfaces an unreadable publication list as 502', async () => {
    service.canUnpublish.mockRejectedValue(
      new BadGatewayException('Failed to read publications from DIAL Core'),
    );

    await request(app.getHttpServer())
      .get(
        '/api/v1/catalog/toolset/toolsets%2Fpublic%2FTeam%2Ftool__1.0.0/unpublish-access',
      )
      .expect(502);
  });
});
