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
import { PublishResultDto } from '../dto/publish-result.dto';
import { PublishController } from '../publish.controller';
import { PublishService } from '../publish.service';
import { VersionStatusesService } from '../version-statuses.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
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

async function buildApp(
  service: unknown,
  versionStatusesService: unknown = {},
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PublishController],
    providers: [
      { provide: PublishService, useValue: service },
      { provide: VersionStatusesService, useValue: versionStatusesService },
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
        undefined,
      );
    });

    it('forwards a submitted author to the service in place of the session name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'DIAL Team' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'DIAL Team',
        undefined,
        undefined,
      );
    });

    it('trims a submitted author before forwarding it', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: '  DIAL Team  ' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'DIAL Team',
        undefined,
        undefined,
      );
    });

    it('falls back to the session display name when author is blank', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: '   ' })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        undefined,
      );
    });

    it('forwards publishCredentials: true from the request body to the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: true })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        true,
      );
    });

    /* The controller never derives, infers, or overrides the flag. */
    it('forwards publishCredentials: false unchanged', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: false })
        .expect(201);

      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'toolset',
        'tool-abc123',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        false,
      );
    });

    it('returns 400 for a non-boolean publishCredentials without calling Core', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, publishCredentials: 'yes' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when author exceeds the 200-character limit', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'a'.repeat(201) })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
    });

    it('returns 400 when author contains a control character', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/catalog/toolset/tool-abc123/publish')
        .send({ ...validBody, author: 'DIAL Team\nInjected log line' })
        .expect(400);

      expect(service.publish).not.toHaveBeenCalled();
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

    it('accepts a skill publish request without version', async () => {
      const res = await request(app.getHttpServer())
        .post(
          '/api/v1/catalog/skill/skills%2Fbucket-123%2Fteam-a%2Fdocs-helper/publish',
        )
        .send({ folderPath: 'Organization/Data Science' })
        .expect(201);

      expect(res.body).toEqual(publishResult);
      expect(service.publish).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        'skill',
        'skills/bucket-123/team-a/docs-helper',
        'Organization/Data Science',
        undefined,
        'Test User',
        undefined,
        undefined,
      );
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

  describe('GET /api/v1/catalog/:entityType/:entityId/version-statuses', () => {
    const entries = [
      {
        id: 'applications/bucket-123/Design/Review__1.0.0',
        version: '1.0.0',
        status: 'published',
        publishedFolders: ['Organization/Design'],
        publishedBy: 'Jane Doe',
      },
      {
        id: 'applications/bucket-123/Design/Review__1.1.0',
        version: '1.1.0',
        status: 'not-published',
        publishedFolders: [],
      },
    ];
    let statusesApp: INestApplication;
    let versionStatuses: { getVersionStatuses: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
      versionStatuses = {
        getVersionStatuses: vi.fn().mockResolvedValue(entries),
      };
      statusesApp = await buildApp(service, versionStatuses);
    });

    afterEach(async () => {
      await statusesApp.close();
    });

    it('delegates to the service with the session and returns 200 with the entries', async () => {
      const res = await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/applications%2Fbucket-123%2FDesign%2FReview__1.0.0/version-statuses',
        )
        .expect(200);

      expect(res.body).toEqual(entries);
      expect(versionStatuses.getVersionStatuses).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        TEST_USER.bucket,
        'application',
        'applications/bucket-123/Design/Review__1.0.0',
      );
    });

    it('returns 400 for an unknown entityType', async () => {
      await request(statusesApp.getHttpServer())
        .get('/api/v1/catalog/unknown-type/tool-abc123/version-statuses')
        .expect(400);

      expect(versionStatuses.getVersionStatuses).not.toHaveBeenCalled();
    });

    it('returns 400 for a path traversal entityId', async () => {
      await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/..%2F..%2Fetc%2Fpasswd/version-statuses',
        )
        .expect(400);

      expect(versionStatuses.getVersionStatuses).not.toHaveBeenCalled();
    });

    it('returns 404 when the service finds no version', async () => {
      versionStatuses.getVersionStatuses.mockRejectedValue(
        new NotFoundException(),
      );

      await request(statusesApp.getHttpServer())
        .get(
          '/api/v1/catalog/application/applications%2Fb%2FX__1.0.0/version-statuses',
        )
        .expect(404);
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      versionStatuses.getVersionStatuses.mockRejectedValue(
        new BadGatewayException(),
      );

      await request(statusesApp.getHttpServer())
        .get('/api/v1/catalog/toolset/toolsets%2Fb%2FX__1.0.0/version-statuses')
        .expect(502);
    });
  });
});
