import {
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ModelCatalogController } from '../../catalog/model-catalog.controller';
import { ModelCatalogService } from '../../catalog/model-catalog.service';
import type {
  ModelCatalogEntryDto,
  ModelCatalogListResponseDto,
} from '../../dto/model-catalog-response.dto';

const gpt: ModelCatalogEntryDto = { id: 'gpt-4o', object: 'model' };
const catalog: ModelCatalogListResponseDto = {
  data: [gpt, { id: 'claude-opus', object: 'model', display_name: 'Claude' }],
};

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

const buildApp = async (service: unknown): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ModelCatalogController],
    providers: [{ provide: ModelCatalogService, useValue: service }],
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

describe('ModelCatalogController (integration)', () => {
  let app: INestApplication;
  let service: {
    listCatalog: ReturnType<typeof vi.fn>;
    getCatalogEntry: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listCatalog: vi.fn().mockResolvedValue(catalog),
      getCatalogEntry: vi.fn().mockResolvedValue(gpt),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('is not marked public, so the global session guard applies', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ModelCatalogController),
    ).toBeUndefined();
    for (const handler of Object.getOwnPropertyNames(
      ModelCatalogController.prototype,
    ).filter((name) => name !== 'constructor')) {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          ModelCatalogController.prototype[
            handler as keyof ModelCatalogController
          ],
        ),
      ).toBeUndefined();
    }
  });

  describe('GET /api/v1/model-catalog', () => {
    it('returns 200 with the catalog body passed through', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog')
        .expect(200);

      expect(res.body).toEqual(catalog);
      expect(service.listCatalog).toHaveBeenCalledOnce();
    });

    it('sets a private 5-minute Cache-Control header on success', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, max-age=300');
    });

    it('returns 404 without the success Cache-Control when the catalog is not configured', async () => {
      service.listCatalog.mockRejectedValue(
        new NotFoundException('Model catalog is not configured'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog')
        .expect(404);

      expect(res.headers['cache-control']).not.toBe('private, max-age=300');
    });

    it('returns 503 when the catalog key is rejected or Core is unreachable', async () => {
      service.listCatalog.mockRejectedValue(
        new ServiceUnavailableException('Model catalog is unavailable'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog')
        .expect(503);

      expect(res.status).not.toBe(401);
      expect(res.body.message).toBe('Model catalog is unavailable');
    });
  });

  describe('GET /api/v1/model-catalog/:modelName', () => {
    it('returns 200 with the catalog entry and the private Cache-Control header', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog/gpt-4o')
        .expect(200);

      expect(res.body).toEqual(gpt);
      expect(res.headers['cache-control']).toBe('private, max-age=300');
      expect(service.getCatalogEntry).toHaveBeenCalledWith('gpt-4o');
    });

    it.each(['bad%2Fname', 'a%20b', 'bad;model', 'bad%00model'])(
      'returns 400 for the invalid model name %s without calling the service',
      async (modelName) => {
        await request(app.getHttpServer())
          .get(`/api/v1/model-catalog/${modelName}`)
          .expect(400);

        expect(service.getCatalogEntry).not.toHaveBeenCalled();
      },
    );

    it('returns 404 when the model is not in the catalog', async () => {
      service.getCatalogEntry.mockRejectedValue(
        new NotFoundException('Model not found'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/model-catalog/secret-model')
        .expect(404);

      expect(res.headers['cache-control']).not.toBe('private, max-age=300');
    });

    it('returns 503 when the catalog key is rejected', async () => {
      service.getCatalogEntry.mockRejectedValue(
        new ServiceUnavailableException('Model catalog is unavailable'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/model-catalog/gpt-4o')
        .expect(503);
    });
  });
});
