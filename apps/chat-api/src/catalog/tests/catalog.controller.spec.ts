import {
  BadGatewayException,
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogFilterService,
  type CatalogFilter,
} from '../catalog-filter.service';
import { CatalogController } from '../catalog.controller';
import { CatalogService } from '../catalog.service';
import type { CatalogResponseDto } from '../dto/catalog-item.dto';

const mockCatalog: CatalogResponseDto = {
  data: [
    { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
    { id: 'my-app', displayName: 'My App', type: 'application' },
  ],
  total: 2,
  filtered: 2,
};

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

function makeFilterService(parsedFilter: CatalogFilter = {}) {
  return {
    parse: vi.fn().mockReturnValue(parsedFilter),
  } as unknown as CatalogFilterService;
}

async function buildApp(
  service: unknown,
  filterService: unknown = makeFilterService(),
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [CatalogController],
    providers: [
      { provide: CatalogService, useValue: service },
      { provide: CatalogFilterService, useValue: filterService },
    ],
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

describe('CatalogController (integration)', () => {
  let app: INestApplication;
  let service: { listCatalogItems: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      listCatalogItems: vi.fn().mockResolvedValue(mockCatalog),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/catalog', () => {
    it('returns 200 with catalog for authenticated user — no params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog')
        .expect(200);

      expect(res.body).toEqual(mockCatalog);
      expect(service.listCatalogItems).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining({}),
      );
    });

    it('passes parsed capabilities filter to catalogService', async () => {
      const parsedFilter: CatalogFilter = {
        capabilities: { chat_completion: true, embeddings: false },
      };
      const filterService = makeFilterService(parsedFilter);
      const localApp = await buildApp(service, filterService);
      try {
        await request(localApp.getHttpServer())
          .get(
            '/api/v1/catalog?modelCapabilities.chat_completion=true&modelCapabilities.embeddings=false',
          )
          .expect(200);

        expect(filterService.parse).toHaveBeenCalledOnce();
        expect(service.listCatalogItems).toHaveBeenCalledWith(
          TEST_USER.sub,
          TEST_USER.at,
          parsedFilter,
        );
      } finally {
        await localApp.close();
      }
    });

    it('returns 400 for unknown query param', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog?capabilities=unknown_cap')
        .expect(400);
    });

    it('returns 400 for invalid capability boolean', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/catalog?modelCapabilities.chat_completion=yes')
        .expect(400);
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listCatalogItems.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer()).get('/api/v1/catalog').expect(401);
    });

    it('returns 502 when service throws BadGatewayException', async () => {
      service.listCatalogItems.mockRejectedValue(new BadGatewayException());
      await request(app.getHttpServer()).get('/api/v1/catalog').expect(502);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listCatalogItems.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer()).get('/api/v1/catalog').expect(503);
    });
  });
});
