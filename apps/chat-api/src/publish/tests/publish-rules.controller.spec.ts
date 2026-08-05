import {
  BadGatewayException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishRulesController } from '../publish-rules.controller';
import { PublishRulesService } from '../publish-rules.service';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  claims: { name: 'Test User' },
};

async function buildApp(service: unknown): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PublishRulesController],
    providers: [{ provide: PublishRulesService, useValue: service }],
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
  return app;
}

describe('PublishRulesController (integration)', () => {
  let app: INestApplication;
  let service: { getRules: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { getRules: vi.fn().mockResolvedValue([]) };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/publish/rules', () => {
    it('delegates to the service and returns 200 with the rules', async () => {
      const rules = [
        { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
      ];
      service.getRules.mockResolvedValue(rules);

      const res = await request(app.getHttpServer())
        .get('/api/v1/publish/rules')
        .query({ folderPath: 'Organization/Data Science' })
        .expect(200);

      expect(res.body).toEqual({ rules });
      expect(service.getRules).toHaveBeenCalledWith(
        TEST_USER.at,
        'Organization/Data Science',
      );
    });

    it('returns 200 with an empty array when the folder has no rules', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/publish/rules')
        .query({ folderPath: 'Organization/Empty Folder' })
        .expect(200);

      expect(res.body).toEqual({ rules: [] });
    });

    it('returns 400 when folderPath is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/publish/rules')
        .expect(400);

      expect(service.getRules).not.toHaveBeenCalled();
    });

    it('returns 400 when folderPath contains a path traversal attempt', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/publish/rules')
        .query({ folderPath: '../etc/passwd' })
        .expect(400);

      expect(service.getRules).not.toHaveBeenCalled();
    });

    it('returns 502 when the service throws BadGatewayException', async () => {
      service.getRules.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer())
        .get('/api/v1/publish/rules')
        .query({ folderPath: 'Organization/Data Science' })
        .expect(502);
    });
  });
});
