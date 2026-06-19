import {
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialModel, DialModelListResponse } from '../../domain/dial-model';
import { ModelsController } from '../models.controller';
import { ModelsService } from '../models.service';

const mockModel: DialModel = {
  id: 'gpt-4o',
  object: 'model',
  owned_by: 'openai',
};
const mockList: DialModelListResponse = { data: [mockModel] };

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ModelsController],
    providers: [{ provide: ModelsService, useValue: service }],
  }).compile();

  const app = module.createNestApplication();
  if (injectUser) {
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
  return app;
}

describe('ModelsController (integration)', () => {
  let app: INestApplication;
  let service: {
    listModels: ReturnType<typeof vi.fn>;
    getModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listModels: vi.fn().mockResolvedValue(mockList),
      getModel: vi.fn().mockResolvedValue(mockModel),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/models', () => {
    it('returns 200 with { data: [...] } for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/models')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(service.listModels).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listModels.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer()).get('/api/v1/models').expect(401);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listModels.mockRejectedValue(new ServiceUnavailableException());
      await request(app.getHttpServer()).get('/api/v1/models').expect(503);
    });
  });

  describe('GET /api/v1/models/:modelName', () => {
    it('returns 200 with a DialModel for a valid model name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/models/gpt-4o')
        .expect(200);

      expect(res.body).toEqual(mockModel);
      expect(service.getModel).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'gpt-4o',
      );
    });

    it('returns 400 for a model name with invalid characters (semicolon)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/models/bad;model')
        .expect(400);
    });

    it('returns 400 for a model name with a null byte (%00)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/models/bad%00model')
        .expect(400);
    });

    it('returns 404 when service throws NotFoundException', async () => {
      service.getModel.mockRejectedValue(
        new NotFoundException('Model not found'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/models/unknown-model')
        .expect(404);
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.getModel.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/models/gpt-4o')
        .expect(401);
    });

    it('accepts dotted model names like anthropic.claude-3-5', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/models/anthropic.claude-3-5')
        .expect(200);
    });
  });
});
