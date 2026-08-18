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
import { DeploymentsService } from '../deployments.service';
import { UserLimitsController } from '../user-limits.controller';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'test-bucket',
};

async function buildApp(service: unknown): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [UserLimitsController],
    providers: [{ provide: DeploymentsService, useValue: service }],
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

describe('UserLimitsController (integration)', () => {
  let app: INestApplication;
  let service: {
    getUserLimits: ReturnType<typeof vi.fn>;
    getUserUsage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getUserLimits: vi.fn(),
      getUserUsage: vi.fn(),
    };
    app = await buildApp(service);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /api/v1/user/limits', () => {
    const mockUserLimits = {
      deployments: {
        'gpt-4o': { dayTokenStats: { total: 10000, used: 4000 } },
      },
      dayCostStats: { total: 100, used: 10 },
    };

    it('returns 200 with aggregate user limits', async () => {
      service.getUserLimits.mockResolvedValue(mockUserLimits);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/limits')
        .expect(200);

      expect(res.body).toEqual(mockUserLimits);
      expect(service.getUserLimits).toHaveBeenCalledWith(TEST_USER.at);
    });

    it('sets Cache-Control: private, no-store', async () => {
      service.getUserLimits.mockResolvedValue(mockUserLimits);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/limits')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.getUserLimits.mockRejectedValue(new UnauthorizedException());

      await request(app.getHttpServer()).get('/api/v1/user/limits').expect(401);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      service.getUserLimits.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await request(app.getHttpServer()).get('/api/v1/user/limits').expect(503);
    });

    it('returns 502 when DIAL Core returns an error response', async () => {
      service.getUserLimits.mockRejectedValue(new BadGatewayException());

      await request(app.getHttpServer()).get('/api/v1/user/limits').expect(502);
    });
  });

  describe('GET /api/v1/user/usage', () => {
    const mockUserUsage = {
      deployments: {
        'gpt-4o': { dayTokenStats: { total: 10000, used: 4000 } },
      },
      dayCostStats: { total: 100, used: 10 },
    };

    it('returns 200 with user usage', async () => {
      service.getUserUsage.mockResolvedValue(mockUserUsage);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/usage')
        .expect(200);

      expect(res.body).toEqual(mockUserUsage);
      expect(service.getUserUsage).toHaveBeenCalledWith(TEST_USER.at);
    });

    it('sets Cache-Control: private, no-store', async () => {
      service.getUserUsage.mockResolvedValue(mockUserUsage);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/usage')
        .expect(200);

      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 401 when service throws UnauthorizedException', async () => {
      service.getUserUsage.mockRejectedValue(new UnauthorizedException());

      await request(app.getHttpServer()).get('/api/v1/user/usage').expect(401);
    });

    it('returns 503 when DIAL Core is unreachable', async () => {
      service.getUserUsage.mockRejectedValue(new ServiceUnavailableException());

      await request(app.getHttpServer()).get('/api/v1/user/usage').expect(503);
    });
  });
});
