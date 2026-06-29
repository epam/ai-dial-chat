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
