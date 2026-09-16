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

/*
 * Two payload fixtures reduced from the real `GET /api/v1/user/usage` capture in
 * `openspec/changes/migrate-usage-reset-times/fixtures/` — one where every
 * day/week/month stat carries `resetsAt`, one with the field stripped. The
 * capture's own shape is preserved: `resetsAt` on the day/week/month token,
 * cost, and request stats; never on the minute/hour stats; present on
 * per-deployment stats as well as top-level ones; a mix of finite and sentinel
 * top-level cost totals. The BFF is a pass-through proxy, so the only thing
 * under test is that neither shape is altered on the way out.
 */
const UNLIMITED_SENTINEL = 9223372036854776000;

const USAGE_WITH_RESETS_AT = {
  deployments: {
    'gpt-5.2-2025-12-11': {
      minuteTokenStats: { total: UNLIMITED_SENTINEL, used: 0 },
      dayTokenStats: {
        total: UNLIMITED_SENTINEL,
        used: 2195,
        resetsAt: '2026-09-16T00:00:00Z',
      },
      weekTokenStats: {
        total: UNLIMITED_SENTINEL,
        used: 4293,
        resetsAt: '2026-09-21T00:00:00Z',
      },
      monthTokenStats: {
        total: UNLIMITED_SENTINEL,
        used: 8535,
        resetsAt: '2026-10-01T00:00:00Z',
      },
      hourRequestStats: { total: UNLIMITED_SENTINEL, used: 1 },
      dayRequestStats: {
        total: UNLIMITED_SENTINEL,
        used: 1,
        resetsAt: '2026-09-16T00:00:00Z',
      },
      minuteCostStats: { total: UNLIMITED_SENTINEL, used: 0 },
      dayCostStats: {
        total: UNLIMITED_SENTINEL,
        used: 0.0048335,
        resetsAt: '2026-09-16T00:00:00Z',
      },
      weekCostStats: {
        total: UNLIMITED_SENTINEL,
        used: 0.0089705,
        resetsAt: '2026-09-21T00:00:00Z',
      },
      monthCostStats: {
        total: UNLIMITED_SENTINEL,
        used: 0.0178885,
        resetsAt: '2026-10-01T00:00:00Z',
      },
    },
  },
  minuteCostStats: { total: UNLIMITED_SENTINEL, used: 0 },
  dayCostStats: {
    total: 110,
    used: 0.42641085,
    resetsAt: '2026-09-16T00:00:00Z',
  },
  weekCostStats: {
    total: UNLIMITED_SENTINEL,
    used: 1.7928459,
    resetsAt: '2026-09-21T00:00:00Z',
  },
  monthCostStats: {
    total: 500,
    used: 2.3991724,
    resetsAt: '2026-10-01T00:00:00Z',
  },
};

const USAGE_WITHOUT_RESETS_AT = {
  deployments: {
    'gpt-5.2-2025-12-11': {
      minuteTokenStats: { total: UNLIMITED_SENTINEL, used: 0 },
      dayTokenStats: { total: UNLIMITED_SENTINEL, used: 2195 },
      weekTokenStats: { total: UNLIMITED_SENTINEL, used: 4293 },
      monthTokenStats: { total: UNLIMITED_SENTINEL, used: 8535 },
      hourRequestStats: { total: UNLIMITED_SENTINEL, used: 1 },
      dayRequestStats: { total: UNLIMITED_SENTINEL, used: 1 },
      minuteCostStats: { total: UNLIMITED_SENTINEL, used: 0 },
      dayCostStats: { total: UNLIMITED_SENTINEL, used: 0.0048335 },
      weekCostStats: { total: UNLIMITED_SENTINEL, used: 0.0089705 },
      monthCostStats: { total: UNLIMITED_SENTINEL, used: 0.0178885 },
    },
  },
  minuteCostStats: { total: UNLIMITED_SENTINEL, used: 0 },
  dayCostStats: { total: 110, used: 0.42641085 },
  weekCostStats: { total: UNLIMITED_SENTINEL, used: 1.7928459 },
  monthCostStats: { total: 500, used: 2.3991724 },
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

    it('forwards resetsAt byte-identically on every stat that carries it', async () => {
      service.getUserUsage.mockResolvedValue(USAGE_WITH_RESETS_AT);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/usage')
        .expect(200);

      expect(res.body).toEqual(USAGE_WITH_RESETS_AT);
      expect(res.body.dayCostStats.resetsAt).toBe('2026-09-16T00:00:00Z');
      expect(res.body.weekCostStats.resetsAt).toBe('2026-09-21T00:00:00Z');
      expect(res.body.monthCostStats.resetsAt).toBe('2026-10-01T00:00:00Z');
      expect(
        res.body.deployments['gpt-5.2-2025-12-11'].dayTokenStats.resetsAt,
      ).toBe('2026-09-16T00:00:00Z');
      expect(
        res.body.deployments['gpt-5.2-2025-12-11'].minuteCostStats,
      ).not.toHaveProperty('resetsAt');
    });

    it('returns 200 with resetsAt simply absent when DIAL Core omits it', async () => {
      service.getUserUsage.mockResolvedValue(USAGE_WITHOUT_RESETS_AT);

      const res = await request(app.getHttpServer())
        .get('/api/v1/user/usage')
        .expect(200);

      expect(res.body).toEqual(USAGE_WITHOUT_RESETS_AT);
      expect(res.body.dayCostStats).not.toHaveProperty('resetsAt');
      expect(res.body.weekCostStats).not.toHaveProperty('resetsAt');
      expect(res.body.monthCostStats).not.toHaveProperty('resetsAt');
      expect(
        res.body.deployments['gpt-5.2-2025-12-11'].dayTokenStats,
      ).not.toHaveProperty('resetsAt');
    });
  });
});
