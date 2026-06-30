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
import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../../openapi/openapi-response.dto';
import { ToolsetsController } from '../toolsets.controller';
import { ToolsetsService } from '../toolsets.service';

const mockToolset: DialToolsetDto = {
  id: 'my-toolset',
  toolset: 'my-toolset',
  object: 'toolset',
};
const mockList: DialToolsetListResponseDto = { data: [mockToolset] };

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ToolsetsController],
    providers: [{ provide: ToolsetsService, useValue: service }],
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

describe('ToolsetsController (integration)', () => {
  let app: INestApplication;
  let service: {
    listToolsets: ReturnType<typeof vi.fn>;
    getToolset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listToolsets: vi.fn().mockResolvedValue(mockList),
      getToolset: vi.fn().mockResolvedValue(mockToolset),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/toolsets', () => {
    it('returns 200 with { data: [...] } for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/toolsets')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(service.listToolsets).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listToolsets.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer()).get('/api/v1/toolsets').expect(401);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listToolsets.mockRejectedValue(new ServiceUnavailableException());
      await request(app.getHttpServer()).get('/api/v1/toolsets').expect(503);
    });
  });

  describe('GET /api/v1/toolsets/:toolsetName', () => {
    it('returns 200 with a DialToolset for a valid toolset name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/toolsets/my-toolset')
        .expect(200);

      expect(res.body).toEqual(mockToolset);
      expect(service.getToolset).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-toolset',
      );
    });

    it('returns 400 for a toolset name with invalid characters (semicolon)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/toolsets/bad;toolset')
        .expect(400);
    });

    it('returns 400 for a toolset name with a null byte (%00)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/toolsets/bad%00toolset')
        .expect(400);
    });

    it('returns 404 when service throws NotFoundException', async () => {
      service.getToolset.mockRejectedValue(
        new NotFoundException('Toolset not found'),
      );
      await request(app.getHttpServer())
        .get('/api/v1/toolsets/unknown-toolset')
        .expect(404);
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.getToolset.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/toolsets/my-toolset')
        .expect(401);
    });

    it('accepts dotted toolset names', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/toolsets/folder.toolset-v1')
        .expect(200);
    });
  });
});

const validBody = {
  name: 'My toolset',
  endpoint: 'https://my-toolset.example.com/mcp',
  transport: 'HTTP',
  authSettings: { authenticationType: 'NONE' },
};

describe('ToolsetsController — write operations (integration)', () => {
  let app: INestApplication;
  let service: {
    createToolset: ReturnType<typeof vi.fn>;
    updateToolset: ReturnType<typeof vi.fn>;
    deleteToolset: ReturnType<typeof vi.fn>;
    loginToolset: ReturnType<typeof vi.fn>;
    logoutToolset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      createToolset: vi.fn().mockResolvedValue({ id: 'toolsets/b/my__0.0.1' }),
      updateToolset: vi.fn().mockResolvedValue({ id: 'my-toolset' }),
      deleteToolset: vi.fn().mockResolvedValue(undefined),
      loginToolset: vi.fn().mockResolvedValue(undefined),
      logoutToolset: vi.fn().mockResolvedValue(undefined),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /api/v1/toolsets', () => {
    it('returns 201 with the created id for a valid body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/toolsets')
        .send(validBody)
        .expect(201);
      expect(res.body).toEqual({ id: 'toolsets/b/my__0.0.1' });
      expect(service.createToolset).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        expect.objectContaining({ name: 'My toolset' }),
      );
    });

    it('returns 400 when a required field is missing', async () => {
      const { endpoint: _omitted, ...noEndpoint } = validBody;
      await request(app.getHttpServer())
        .post('/api/v1/toolsets')
        .send(noEndpoint)
        .expect(400);
      expect(service.createToolset).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid endpoint protocol', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/toolsets')
        .send({ ...validBody, endpoint: 'ftp://nope' })
        .expect(400);
    });

    it('returns 400 for an unknown extra property (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/toolsets')
        .send({ ...validBody, hacker: 'x' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/toolsets/:toolsetName', () => {
    it('returns 200 with the updated id for a valid body', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/toolsets/my-toolset')
        .send(validBody)
        .expect(200);
      expect(res.body).toEqual({ id: 'my-toolset' });
      expect(service.updateToolset).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-toolset',
        expect.objectContaining({ name: 'My toolset' }),
      );
    });

    it('returns 400 for a toolset name with invalid characters', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/toolsets/bad;name')
        .send(validBody)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/toolsets/:toolsetName', () => {
    it('returns 204 on success', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/toolsets/my-toolset')
        .expect(204);
      expect(service.deleteToolset).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
        'my-toolset',
      );
    });

    it('returns 400 for a toolset name with invalid characters', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/toolsets/bad;name')
        .expect(400);
    });
  });

  describe('POST /api/v1/toolsets/:toolsetName/login', () => {
    it('returns 200 with { success: true } for a valid API key body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/toolsets/my-toolset/login')
        .send({
          url: 'my-toolset',
          credentialsLevel: 'USER',
          authenticationType: 'API_KEY',
          apiKey: 'secret',
        })
        .expect(200);
      expect(res.body).toEqual({ success: true });
    });

    it('returns 400 when credentialsLevel is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/toolsets/my-toolset/login')
        .send({
          url: 'my-toolset',
          credentialsLevel: 'NOPE',
          authenticationType: 'API_KEY',
        })
        .expect(400);
    });

    it('returns 400 when API key auth omits the API key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/toolsets/my-toolset/login')
        .send({
          url: 'my-toolset',
          credentialsLevel: 'USER',
          authenticationType: 'API_KEY',
        })
        .expect(400);
      expect(service.loginToolset).not.toHaveBeenCalled();
    });

    it('returns 400 when API key auth sends an empty API key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/toolsets/my-toolset/login')
        .send({
          url: 'my-toolset',
          credentialsLevel: 'USER',
          authenticationType: 'API_KEY',
          apiKey: '',
        })
        .expect(400);
      expect(service.loginToolset).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/toolsets/:toolsetName/logout', () => {
    it('returns 200 with { success: true }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/toolsets/my-toolset/logout')
        .send({
          url: 'my-toolset',
          credentialsLevel: 'USER',
          authenticationType: 'OAUTH',
        })
        .expect(200);
      expect(res.body).toEqual({ success: true });
    });
  });

  describe('unauthenticated', () => {
    it('returns 500 when no session user is present on a write', async () => {
      const noUserApp = await buildApp(service, false);
      // No req.user → controller reads undefined; the global pipe accepts the
      // body but the handler throws when destructuring the session user.
      await request(noUserApp.getHttpServer())
        .post('/api/v1/toolsets')
        .send(validBody)
        .expect(500);
      await noUserApp.close();
    });
  });
});
