import {
  BadGatewayException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishResultDto } from '../dto/publish-result.dto';
import { PublishController } from '../publish.controller';
import { PublishService } from '../publish.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  /* The service qualifies a prompt's bucket-relative id against the caller's own bucket. */
  bucket: 'bucket-123',
  claims: { name: 'Test User' },
};

const publishResult: PublishResultDto = {
  entityId: 'tool-abc123',
  entityType: CatalogEntityType.Toolset,
  folderPath: 'Organization/Data Science',
  version: '1.2.0',
  publishedAt: '2026-07-13T10:00:00.000Z',
  publishedBy: 'user@example.com',
};

async function buildApp(service: unknown): Promise<INestApplication> {
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
}

describe('PublishController (integration)', () => {
  let app: INestApplication;
  let service: {
    publish: ReturnType<typeof vi.fn>;
    getPublishHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      publish: vi.fn().mockResolvedValue(publishResult),
      getPublishHistory: vi.fn().mockResolvedValue([publishResult]),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/catalog/:entityType/:entityId/publish', () => {
    const validBody = {
      folderPath: 'Organization/Data Science',
      version: '1.2.0',
    };

    it('delegates to the service and returns 201 with the publish result', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(201);

      expect(res.body).toEqual(publishResult);
      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
      );
    });

    it('forwards rules from the request body to the service', async () => {
      const rules = [
        {
          source: 'roles',
          function: 'CONTAIN',
          targets: ['engineering', 'support'],
        },
      ];

      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, rules })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        rules,
      );
    });

    it('returns 400 for an invalid rule function enum value', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({
          ...validBody,
          rules: [
            { source: 'roles', function: 'MATCHES', targets: ['engineering'] },
          ],
        })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/unknown-type/tool-abc123/publish')
        .send(validBody)
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when folderPath contains a path traversal attempt', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, folderPath: '../etc/passwd' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when version is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ folderPath: 'Organization/Data Science' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 403 when the service throws ForbiddenException', async () => {
      service.publish.mockRejectedValue(new ForbiddenException());
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(403);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.publish.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send(validBody)
        .expect(502);
    });
  });

  describe('GET /api/v1/catalog/:entityType/:entityId/publish-history', () => {
    it('delegates to the service and returns 200 with the history list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/toolset/tool-abc123/publish-history')
        .expect(200);

      expect(res.body).toEqual([publishResult]);
      expect(service.getPublishHistory).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
      );
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog/unknown-type/tool-abc123/publish-history')
        .expect(400);

      expect(service.getPublishHistory).not.toHaveBeenCalled();
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.getPublishHistory.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/catalog/toolset/tool-abc123/publish-history')
        .expect(502);
    });
  });
});
