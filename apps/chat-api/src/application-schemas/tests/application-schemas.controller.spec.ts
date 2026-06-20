import {
  BadGatewayException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ApplicationSchemasController } from '../application-schemas.controller';
import { ApplicationSchemasService } from '../application-schemas.service';
import type { ApplicationSchemasResponseDto } from '../dto/application-schema.dto';

const mockSchema = {
  $id: 'https://example.com/schemas/quick-app',
  title: 'Quick App',
};

const mockList: ApplicationSchemasResponseDto = {
  schemas: [
    {
      id: 'https://example.com/schemas/quick-app',
      displayName: 'Quick App',
      viewerUrl: 'https://example.com/viewer',
      editorUrl: 'https://example.com/editor',
      schemaEndpoint: 'https://example.com/schema',
    },
  ],
};

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ApplicationSchemasController],
    providers: [{ provide: ApplicationSchemasService, useValue: service }],
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
  await app.listen(0, '127.0.0.1');
  return app;
}

describe('ApplicationSchemasController (integration)', () => {
  let app: INestApplication;
  let service: {
    listApplicationSchemas: ReturnType<typeof vi.fn>;
    getApplicationSchema: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    service = {
      listApplicationSchemas: vi.fn(),
      getApplicationSchema: vi.fn(),
    };
    app = await buildApp(service);
  });

  beforeEach(() => {
    service.listApplicationSchemas.mockReset().mockResolvedValue(mockList);
    service.getApplicationSchema.mockReset().mockResolvedValue(mockSchema);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/application-schemas', () => {
    it('returns 200 with { schemas: [...] } for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(200);

      expect(res.body).toEqual(mockList);
    });

    it('calls service with sub and at from req.user', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(200);

      expect(service.listApplicationSchemas).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listApplicationSchemas.mockRejectedValue(
        new UnauthorizedException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(401);
    });

    it('returns 403 when service throws ForbiddenException', async () => {
      service.listApplicationSchemas.mockRejectedValue(
        new ForbiddenException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(403);
    });

    it('returns 502 when service throws BadGatewayException', async () => {
      service.listApplicationSchemas.mockRejectedValue(
        new BadGatewayException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(502);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listApplicationSchemas.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/application-schemas')
        .expect(503);
    });
  });

  describe('GET /api/v1/application-schemas/:id', () => {
    const schemaId = 'quick-app-schema-123';

    it('returns 200 with schema object for valid id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/application-schemas/${schemaId}`)
        .expect(200);

      expect(res.body).toEqual(mockSchema);
    });

    it('calls service with sub, at, and decoded id', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/application-schemas/${schemaId}`)
        .expect(200);

      expect(service.getApplicationSchema).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        schemaId,
      );
    });

    it('returns 404 when service throws NotFoundException', async () => {
      service.getApplicationSchema.mockRejectedValue(new NotFoundException());
      await request(app.getHttpServer())
        .get(`/api/v1/application-schemas/${schemaId}`)
        .expect(404);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.getApplicationSchema.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .get(`/api/v1/application-schemas/${schemaId}`)
        .expect(503);
    });
  });
});
