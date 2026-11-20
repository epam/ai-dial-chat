import {
  type CanActivate,
  type INestApplication,
  Logger,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsClient } from '../analytics/analytics.client';
import { UsageHistoryService } from '../usage-history.service';
import { UserUsageHistoryController } from '../user-usage-history.controller';
import {
  type FakeAnalyticsServer,
  type FakeResponse,
  type RecordedRequest,
  startFakeAnalytics,
} from './fake-analytics.server';

const TEST_USER = {
  sub: 'user-123',
  at: 'test-access-token',
  bucket: 'test-bucket',
};

/** Stands in for the global session guard rejecting a call with no session. */
class RejectingSessionGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException();
  }
}

const HISTORY_PATH = '/api/v1/user/usage/history';

/*
 * ConfigService reads process.env before its constructor config, so the
 * analytics settings are stubbed in the environment itself.
 */
const configureAnalytics = (url: string | undefined): void => {
  vi.stubEnv('ANALYTICS_URL', url ?? '');
  vi.stubEnv('ANALYTICS_TIMEOUT_MS', '1000');
};

const buildApp = async ({
  hasSession = true,
} = {}): Promise<INestApplication> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [UserUsageHistoryController],
    providers: [
      AnalyticsClient,
      UsageHistoryService,
      { provide: ConfigService, useValue: new ConfigService({}) },
      ...(hasSession
        ? []
        : [{ provide: APP_GUARD, useClass: RejectingSessionGuard }]),
    ],
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
};

describe('UserUsageHistoryController (integration)', () => {
  let analytics: FakeAnalyticsServer;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    analytics = await startFakeAnalytics();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await analytics.close();
    vi.unstubAllEnvs();
  });

  describe('request validation', () => {
    beforeEach(async () => {
      configureAnalytics(analytics.url);
      app = await buildApp();
    });

    it.each([
      ['a missing period', ''],
      ['an unknown period', '?period=year'],
      ['an empty period', '?period='],
      ['a repeated period', '?period=today&period=week'],
      ['an extra query parameter', "?period=today&filter=user_hash%3D'x'"],
      ['a cost object without a policy', '?period=today&costObject=eng'],
      ['a policy without a cost object', '?period=today&policy=policies%2Fp'],
      ['an empty cost object', '?period=today&costObject=&policy=policies%2Fp'],
      [
        'an over-long policy',
        `?period=today&costObject=eng&policy=${'p'.repeat(1025)}`,
      ],
      ['a repeated policy', '?period=today&costObject=eng&policy=a&policy=b'],
    ])('rejects %s with 400 and calls no upstream', async (_label, query) => {
      await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}${query}`)
        .expect(400);

      expect(analytics.requests).toEqual([]);
    });
  });

  it('rejects a request without a session with 401 and calls no upstream', async () => {
    configureAnalytics(analytics.url);
    app = await buildApp({ hasSession: false });

    await request(app.getHttpServer())
      .get(`${HISTORY_PATH}?period=today`)
      .expect(401);

    expect(analytics.requests).toEqual([]);
  });

  it('answers not_configured without any outbound call when ANALYTICS_URL is unset', async () => {
    configureAnalytics(undefined);
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(`${HISTORY_PATH}?period=month`)
      .expect(200);

    expect(response.body).toEqual({
      available: false,
      reason: 'not_configured',
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(analytics.requests).toEqual([]);
  });

  describe('with DIAL Analytics configured', () => {
    const ok = (body: unknown): FakeResponse => ({ status: 200, body });

    /* A minimal caller with one request today on gpt-4o. */
    const adas =
      (overrides: Partial<Record<'execute', FakeResponse>> = {}) =>
      (recorded: RecordedRequest): FakeResponse => {
        if (recorded.path === '/v1/queries/entities/schema/dial_usage_log') {
          return ok({ fields: [{ name: 'deployment' }] });
        }
        if (overrides.execute) return overrides.execute;
        const groupBy = (recorded.body as { group_by: string[] }).group_by;
        const today = new Date().toISOString().slice(0, 10);
        const usage = { usage_spend: '0.25', usage_requests: 2 };
        if (groupBy.join() === 'deployment') {
          return ok({ rows: [{ deployment: 'gpt-4o', ...usage }] });
        }
        return ok({
          rows: [
            {
              usage_day: `${today} 00:00:00.000`,
              ...(groupBy.length === 2 ? { deployment: 'gpt-4o' } : {}),
              ...usage,
            },
          ],
        });
      };

    let logs: ReturnType<typeof vi.spyOn>[];

    beforeEach(async () => {
      logs = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map(
        (level) =>
          vi.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
      );
      configureAnalytics(analytics.url);
      app = await buildApp();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('forwards the session token as a bearer and returns the available history', async () => {
      analytics.setHandler(adas());

      const response = await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}?period=today`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).toMatchObject({
        available: true,
        period: { name: 'today' },
        currency: 'USD',
        totals: { spend: 0.25, requests: 2 },
        byModel: [{ deployment: 'gpt-4o', spend: 0.25, requests: 2 }],
      });
      expect(response.body).not.toHaveProperty('byClient');
      expect(analytics.requests.length).toBeGreaterThan(0);
      for (const recorded of analytics.requests) {
        expect(recorded.headers.authorization).toBe('Bearer test-access-token');
      }
    });

    it('confines every query to the caller own rows without a permissions pre-check', async () => {
      analytics.setHandler(adas());

      const response = await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}?period=today`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).toMatchObject({
        available: true,
        totals: { spend: 0.25, requests: 2 },
      });
      const executed = analytics.requests.filter(
        (recorded) => recorded.path === '/v1/queries/execute',
      );
      expect(executed.length).toBeGreaterThan(0);
      expect(
        analytics.requests.some((recorded) =>
          recorded.path.startsWith('/v1/tables/'),
        ),
      ).toBe(false);
      for (const recorded of executed) {
        expect(
          (recorded.body as { filter: { args: unknown[] } }).filter.args,
        ).toContainEqual({
          op: 'eq',
          args: [
            { type: 'field', name: 'user_hash' },
            { type: 'param', name: 'caller.user_hash' },
          ],
        });
      }
    });

    it('narrows the queries to the requested budget and echoes it', async () => {
      const base = adas();
      analytics.setHandler((recorded) =>
        recorded.path === '/v1/queries/entities/schema/dial_usage_log'
          ? ok({
              fields: [
                { name: 'deployment' },
                { name: 'budget_cost_object' },
                { name: 'budget_policy' },
                { name: 'budget_outcome' },
              ],
            })
          : base(recorded),
      );

      const response = await request(app?.getHttpServer())
        .get(
          `${HISTORY_PATH}?period=today&costObject=engineering&policy=policies%2Fcompany%2Fpro`,
        )
        .expect(200);

      expect(response.body).toMatchObject({
        available: true,
        budget: { costObject: 'engineering', policy: 'policies/company/pro' },
        totals: { spend: 0.25, requests: 2 },
      });
      const executed = analytics.requests.filter(
        (recorded) => recorded.path === '/v1/queries/execute',
      );
      expect(executed.length).toBeGreaterThan(0);
      for (const recorded of executed) {
        expect(JSON.stringify(recorded.body)).toContain(
          '"value":"policies/company/pro"',
        );
      }
    });

    it('answers budget_unsupported when ADAS has no budget columns', async () => {
      analytics.setHandler(adas());

      const response = await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}?period=month&costObject=eng&policy=p`)
        .expect(200);

      expect(response.body).toEqual({
        available: false,
        reason: 'budget_unsupported',
      });
    });

    it.each<[string, Partial<Record<'execute', FakeResponse>>, string]>([
      ['ADAS 401', { execute: { status: 401 } }, 'forbidden'],
      ['ADAS 403', { execute: { status: 403 } }, 'forbidden'],
      ['ADAS 404', { execute: { status: 404 } }, 'forbidden'],
      [
        'an ADAS without caller values (400)',
        { execute: { status: 400 } },
        'forbidden',
      ],
      ['ADAS 503', { execute: { status: 503 } }, 'unavailable'],
      ['an ADAS timeout', { execute: { hang: true } }, 'unavailable'],
    ])('answers 200 with reason %s → %s', async (_label, overrides, reason) => {
      analytics.setHandler(adas(overrides));

      const response = await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}?period=today`)
        .expect(200);

      expect(response.body).toEqual({ available: false, reason });
      expect(response.headers['cache-control']).toBe('private, no-store');
    });

    it('never logs the session token', async () => {
      analytics.setHandler(adas({ execute: { status: 403 } }));

      await request(app?.getHttpServer())
        .get(`${HISTORY_PATH}?period=week`)
        .expect(200);

      const logged = JSON.stringify(logs.flatMap((spy) => spy.mock.calls));
      expect(logged).toContain('refused');
      expect(logged).not.toContain('test-access-token');
    });
  });
});
