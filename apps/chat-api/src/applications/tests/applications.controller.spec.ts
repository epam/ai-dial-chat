import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsController } from '../applications.controller';
import { ApplicationsService } from '../applications.service';
import type { ApplicationsResponseDto } from '../dto/application.dto';

const mockApp = { id: 'my-app', object: 'application', display_name: 'My App' };
const mockList: ApplicationsResponseDto = { data: [mockApp] };

const TEST_USER = { sub: 'user-123', at: 'test-access-token' };

async function buildApp(
  service: unknown,
  injectUser = true,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ApplicationsController],
    providers: [{ provide: ApplicationsService, useValue: service }],
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

describe('ApplicationsController (integration)', () => {
  let app: INestApplication;
  let service: { listApplications: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { listApplications: vi.fn().mockResolvedValue(mockList) };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/applications', () => {
    it('returns 200 with { data: [...] } for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(200);

      expect(res.body).toEqual(mockList);
      expect(service.listApplications).toHaveBeenCalledWith(
        TEST_USER.sub,
        TEST_USER.at,
      );
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.listApplications.mockRejectedValue(new UnauthorizedException());
      await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(401);
    });

    it('returns 503 when service throws ServiceUnavailableException', async () => {
      service.listApplications.mockRejectedValue(
        new ServiceUnavailableException(),
      );
      await request(app.getHttpServer())
        .get('/api/v1/applications')
        .expect(503);
    });
  });
});
