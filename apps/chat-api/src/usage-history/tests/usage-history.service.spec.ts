import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsClient } from '../analytics/analytics.client';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import { UsageHistoryService } from '../usage-history.service';
import {
  type FakeAnalyticsServer,
  type FakeResponse,
  type RecordedRequest,
  startFakeAnalytics,
} from './fake-analytics.server';

const TOKEN = 'session-token-for-history';
const NOW = new Date('2026-11-03T10:00:00.000Z');

type QueryKind = 'daily' | 'ranking' | 'dailyModels' | 'clients';

/* Tells the four fixed query documents apart by their grouping. */
const queryKind = (body: unknown): QueryKind => {
  const groupBy = (body as { group_by: string[] }).group_by.join(',');
  switch (groupBy) {
    case 'usage_day':
      return 'daily';
    case 'deployment':
      return 'ranking';
    case 'usage_day,deployment':
      return 'dailyModels';
    case 'usage_client':
      return 'clients';
    default:
      throw new Error(`unexpected query ${groupBy}`);
  }
};

const rows = (...values: object[]): FakeResponse => ({
  status: 200,
  body: { rows: values, totalCount: null },
});

const ROW_RESTRICTED: FakeResponse = {
  status: 200,
  body: {
    name: 'dial_usage_log',
    permissions: { get: true, read: true, rows_restricted: true },
  },
};

const SCHEMA_WITH_CLIENT: FakeResponse = {
  status: 200,
  body: {
    entity: 'dial_usage_log',
    fields: [
      { name: 'deployment' },
      { name: 'usage_client_identity.client_type' },
    ],
  },
};

const SCHEMA_WITHOUT_CLIENT: FakeResponse = {
  status: 200,
  body: { entity: 'dial_usage_log', fields: [{ name: 'deployment' }] },
};

/* The spec's example month: gpt-4o and my-app, used on the 2nd and the 3rd. */
const EXAMPLE_QUERIES: Record<QueryKind, FakeResponse> = {
  daily: rows(
    {
      usage_day: '2026-11-02 00:00:00.000',
      usage_spend: '1.000000000000',
      usage_requests: 30,
    },
    {
      usage_day: '2026-11-03 00:00:00.000',
      usage_spend: '0.2345675',
      usage_requests: 12,
    },
  ),
  ranking: rows(
    {
      deployment: 'gpt-4o',
      usage_spend: '1.1345675',
      usage_spend_rank: 1.1345675,
      usage_requests: 39,
    },
    {
      deployment: 'my-app',
      usage_spend: '0.1',
      usage_spend_rank: 0.1,
      usage_requests: 3,
    },
  ),
  dailyModels: rows(
    {
      usage_day: '2026-11-02 00:00:00.000',
      deployment: 'gpt-4o',
      usage_spend: '0.9',
      usage_requests: 27,
    },
    {
      usage_day: '2026-11-02 00:00:00.000',
      deployment: 'my-app',
      usage_spend: '0.1',
      usage_requests: 3,
    },
    {
      usage_day: '2026-11-03 00:00:00.000',
      deployment: 'gpt-4o',
      usage_spend: '0.2345675',
      usage_requests: 12,
    },
  ),
  clients: rows(
    {
      usage_client: 'chat',
      usage_spend: '1',
      usage_spend_rank: 1,
      usage_requests: 35,
    },
    {
      usage_client: 'claudecode',
      usage_spend: '0.2345675',
      usage_spend_rank: 0.2345675,
      usage_requests: 7,
    },
  ),
};

interface AdasScript {
  table?: FakeResponse;
  schema?: FakeResponse;
  queries?: Partial<Record<QueryKind, FakeResponse>>;
}

const adas =
  ({
    table = ROW_RESTRICTED,
    schema = SCHEMA_WITH_CLIENT,
    queries = {},
  }: AdasScript = {}) =>
  (request: RecordedRequest): FakeResponse => {
    if (request.path === '/v1/tables/dial_usage_log') return table;
    if (request.path === '/v1/queries/entities/schema/dial_usage_log')
      return schema;
    if (request.path === '/v1/queries/execute') {
      const kind = queryKind(request.body);
      return queries[kind] ?? EXAMPLE_QUERIES[kind];
    }
    return { status: 404 };
  };

const executed = (server: FakeAnalyticsServer): QueryKind[] =>
  server.requests
    .filter((request) => request.path === '/v1/queries/execute')
    .map((request) => queryKind(request.body));

describe('UsageHistoryService', () => {
  let analytics: FakeAnalyticsServer;
  let service: UsageHistoryService;
  let logs: ReturnType<typeof vi.spyOn>[];

  const history = (period = UsageHistoryPeriod.Month) =>
    service.getUsageHistory(TOKEN, period);

  const logged = (): string =>
    JSON.stringify(logs.flatMap((spy) => spy.mock.calls));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    analytics = await startFakeAnalytics(adas());
    vi.stubEnv('ANALYTICS_URL', analytics.url);
    vi.stubEnv('ANALYTICS_TIMEOUT_MS', '1000');
    service = new UsageHistoryService(
      new AnalyticsClient(new ConfigService({})),
    );
    logs = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map(
      (level) =>
        vi.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await analytics.close();
  });

  describe('row-restriction guard', () => {
    it.each([
      [
        'an unrestricted administrator view',
        { read: true, rows_restricted: false },
      ],
      [
        'the none security mode shape',
        { get: true, read: true, write: true, rows_restricted: false },
      ],
      ['a view without read', { read: false, rows_restricted: true }],
      ['a table without permissions', undefined],
    ])(
      'answers forbidden and runs no usage query for %s',
      async (_label, permissions) => {
        analytics.setHandler(
          adas({
            table: {
              status: 200,
              body: { name: 'dial_usage_log', permissions },
            },
          }),
        );

        await expect(history()).resolves.toEqual({
          available: false,
          reason: 'forbidden',
        });
        expect(executed(analytics)).toEqual([]);
        expect(logged()).toContain('not row-restricted');
      },
    );

    it.each([401, 403, 404])(
      'answers forbidden when the table read is answered %i',
      async (status) => {
        analytics.setHandler(adas({ table: { status } }));

        await expect(history()).resolves.toEqual({
          available: false,
          reason: 'forbidden',
        });
        expect(executed(analytics)).toEqual([]);
      },
    );

    it('answers unavailable when the table read fails with a server error', async () => {
      analytics.setHandler(adas({ table: { status: 502 } }));

      await expect(history()).resolves.toEqual({
        available: false,
        reason: 'unavailable',
      });
      expect(executed(analytics)).toEqual([]);
    });

    it('answers unavailable when the table read times out', async () => {
      analytics.setHandler(adas({ table: { hang: true } }));

      await expect(history()).resolves.toEqual({
        available: false,
        reason: 'unavailable',
      });
    });
  });

  describe('available history', () => {
    it('returns the spec example for a month', async () => {
      await expect(history()).resolves.toEqual({
        available: true,
        period: {
          name: 'month',
          from: '2026-11-01T00:00:00.000Z',
          to: '2026-11-03T10:00:00.000Z',
        },
        currency: 'USD',
        totals: { spend: 1.234568, requests: 42 },
        daily: [
          { date: '2026-11-01', spend: 0, requests: 0, byModel: {} },
          {
            date: '2026-11-02',
            spend: 1,
            requests: 30,
            byModel: { 'gpt-4o': 0.9, 'my-app': 0.1 },
          },
          {
            date: '2026-11-03',
            spend: 0.234568,
            requests: 12,
            byModel: { 'gpt-4o': 0.234568 },
          },
        ],
        byModel: [
          { deployment: 'gpt-4o', spend: 1.134568, requests: 39 },
          { deployment: 'my-app', spend: 0.1, requests: 3 },
        ],
        byClient: [
          { client: 'chat', spend: 1, requests: 35 },
          { client: 'claudecode', spend: 0.234568, requests: 7 },
        ],
      });
    });

    it('sends the session token on every call and queries only root spans of the window', async () => {
      await history();

      expect(analytics.requests).toHaveLength(6);
      for (const request of analytics.requests) {
        expect(request.headers.authorization).toBe(`Bearer ${TOKEN}`);
      }
      const filters = analytics.requests
        .filter((request) => request.path === '/v1/queries/execute')
        .map((request) =>
          JSON.stringify((request.body as { filter: unknown }).filter),
        );
      for (const filter of filters) {
        expect(filter).toContain(
          '{"op":"eq","args":[{"type":"field","name":"parent_deployment"},{"type":"value","value_type":"null","value":null}]}',
        );
        expect(filter).toContain(
          `"value":"${Date.parse('2026-11-01T00:00:00.000Z')}"`,
        );
        expect(filter).toContain(`"value":"${NOW.getTime()}"`);
      }
      expect(
        new Set(analytics.requests.map((r) => `${r.method} ${r.path}`)).size,
      ).toBe(3);
    });

    it('asks the per-day query only for the ranked deployments', async () => {
      await history();

      const perDay = analytics.requests.find(
        (request) =>
          request.path === '/v1/queries/execute' &&
          queryKind(request.body) === 'dailyModels',
      );
      expect(JSON.stringify(perDay?.body)).toContain(
        '"items":[{"type":"value","value_type":"string","value":"gpt-4o"},{"type":"value","value_type":"string","value":"my-app"}]',
      );
    });

    it('skips the per-day query when there is no usage', async () => {
      analytics.setHandler(
        adas({
          queries: { daily: rows(), ranking: rows(), clients: rows() },
        }),
      );

      const result = await history(UsageHistoryPeriod.Today);

      expect(result).toMatchObject({
        available: true,
        totals: { spend: 0, requests: 0 },
        daily: [{ date: '2026-11-03', spend: 0, requests: 0, byModel: {} }],
        byModel: [],
        byClient: [],
      });
      expect(executed(analytics).sort()).toEqual([
        'clients',
        'daily',
        'ranking',
      ]);
    });

    it('queries ADAS again for every request', async () => {
      await expect(history()).resolves.toMatchObject({ available: true });
      const first = analytics.requests.length;
      await expect(history()).resolves.toMatchObject({ available: true });

      expect(analytics.requests.length).toBe(first * 2);
    });

    it('never logs the token or row values', async () => {
      await history();

      expect(logged()).not.toContain(TOKEN);
      expect(logged()).not.toContain('gpt-4o');
    });
  });

  describe('unavailable states', () => {
    it.each<[string, QueryKind, FakeResponse, string]>([
      ['daily totals answer 503', 'daily', { status: 503 }, 'unavailable'],
      ['the ranking times out', 'ranking', { hang: true }, 'unavailable'],
      [
        'the per-day query answers 401',
        'dailyModels',
        { status: 401 },
        'forbidden',
      ],
      ['the ranking answers 403', 'ranking', { status: 403 }, 'forbidden'],
      [
        'the ranking exceeds the query budget (422)',
        'ranking',
        { status: 422 },
        'unavailable',
      ],
      ['daily totals answer 400', 'daily', { status: 400 }, 'unavailable'],
      [
        'the per-day query answers 429',
        'dailyModels',
        { status: 429 },
        'unavailable',
      ],
      [
        'daily totals are malformed',
        'daily',
        rows({ usage_day: 'yesterday', usage_spend: '1', usage_requests: 1 }),
        'unavailable',
      ],
    ])(
      'answers %s with %s and no partial data',
      async (_label, kind, response, reason) => {
        analytics.setHandler(adas({ queries: { [kind]: response } }));

        await expect(history()).resolves.toEqual({ available: false, reason });
        expect(logged()).not.toContain(TOKEN);
      },
    );

    it('makes one request per query, without retries', async () => {
      analytics.setHandler(adas({ queries: { daily: { status: 503 } } }));

      await history();

      const kinds = executed(analytics);
      expect(kinds.filter((kind) => kind === 'daily')).toHaveLength(1);
      expect(analytics.requests.length).toBeLessThanOrEqual(6);
    });

    it('logs a refused token at warn with a configuration hint', async () => {
      analytics.setHandler(adas({ queries: { daily: { status: 401 } } }));

      await history();

      const warn = logs[2];
      expect(JSON.stringify(warn.mock.calls)).toContain(
        'configuration problem',
      );
    });
  });

  describe('client breakdown', () => {
    it('starts the required queries without waiting for a slow schema discovery', async () => {
      let coreStartedFirst = false;
      const base = adas();
      analytics.setHandler(async (recorded) => {
        if (recorded.path !== '/v1/queries/entities/schema/dial_usage_log') {
          return base(recorded);
        }
        /* Answer discovery only once both required queries have arrived (or give up). */
        for (let waited = 0; waited < 800; waited += 20) {
          const kinds = executed(analytics);
          if (kinds.includes('daily') && kinds.includes('ranking')) {
            coreStartedFirst = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return SCHEMA_WITH_CLIENT;
      });

      const result = await history();

      expect(coreStartedFirst).toBe(true);
      expect(result).toMatchObject({
        available: true,
        byClient: [
          { client: 'chat', spend: 1, requests: 35 },
          { client: 'claudecode', spend: 0.234568, requests: 7 },
        ],
      });
    });

    it('does not log a discovery failure when the guard refuses', async () => {
      analytics.setHandler(
        adas({ table: { status: 403 }, schema: { status: 500 } }),
      );

      await expect(history()).resolves.toEqual({
        available: false,
        reason: 'forbidden',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(logged()).not.toContain('client breakdown omitted');
    });

    it('omits byClient and skips its query when the enrichment field is absent', async () => {
      analytics.setHandler(adas({ schema: SCHEMA_WITHOUT_CLIENT }));

      const result = await history();

      expect(result.available).toBe(true);
      expect('byClient' in result).toBe(false);
      expect(executed(analytics)).not.toContain('clients');
    });

    it('omits byClient when schema discovery fails, keeping the rest', async () => {
      analytics.setHandler(adas({ schema: { status: 500 } }));

      const result = await history();

      expect(result).toMatchObject({
        available: true,
        totals: { requests: 42 },
      });
      expect('byClient' in result).toBe(false);
      expect(logged()).toContain('client breakdown omitted');
    });

    it('omits byClient when the client query fails, keeping the rest', async () => {
      analytics.setHandler(adas({ queries: { clients: { status: 400 } } }));

      const result = await history();

      expect(result).toMatchObject({
        available: true,
        totals: { requests: 42 },
      });
      expect('byClient' in result).toBe(false);
    });
  });
});
