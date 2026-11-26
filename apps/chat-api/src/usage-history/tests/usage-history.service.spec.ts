import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialAnalyticsClientService } from '../../dial/dial-analytics-client.service';
import {
  type FakeAnalyticsServer,
  type FakeResponse,
  type RecordedRequest,
  startFakeAnalytics,
} from '../../dial/tests/fake-analytics.server';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import { UsageHistoryService } from '../usage-history.service';

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

const SCHEMA_WITH_BUDGET: FakeResponse = {
  status: 200,
  body: {
    entity: 'dial_usage_log',
    fields: [
      { name: 'deployment' },
      { name: 'usage_client_identity.client_type' },
      { name: 'budget_cost_object' },
      { name: 'budget_policy' },
      { name: 'budget_outcome' },
    ],
  },
};

const BUDGET = { costObject: 'engineering', policy: 'policies/company/pro' };

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
  schema?: FakeResponse;
  queries?: Partial<Record<QueryKind, FakeResponse>>;
}

const adas =
  ({ schema = SCHEMA_WITH_CLIENT, queries = {} }: AdasScript = {}) =>
  (request: RecordedRequest): FakeResponse => {
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

/* The own-rows caller value every query filter must carry. */
const OWN_ROWS =
  '{"op":"eq","args":[{"type":"field","name":"user_hash"},{"type":"param","name":"caller.user_hash"}]}';

const executedFilters = (server: FakeAnalyticsServer): string[] =>
  server.requests
    .filter((request) => request.path === '/v1/queries/execute')
    .map((request) =>
      JSON.stringify((request.body as { filter: unknown }).filter),
    );

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
    vi.stubEnv('ANALYTICS_TIMEOUT_MS', undefined);
    service = new UsageHistoryService(
      new DialAnalyticsClientService(
        new ConfigService({ ANALYTICS_TIMEOUT_MS: 1000 }),
      ),
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

  describe('access', () => {
    it('sends every query with the own-rows filter and no permissions pre-check', async () => {
      await expect(history()).resolves.toMatchObject({
        available: true,
        totals: { spend: 1.234568, requests: 42 },
      });

      expect(
        analytics.requests.some((request) =>
          request.path.startsWith('/v1/tables/'),
        ),
      ).toBe(false);
      expect(executed(analytics).sort()).toEqual(
        ['clients', 'daily', 'dailyModels', 'ranking'].sort(),
      );
      for (const filter of executedFilters(analytics)) {
        expect(filter).toContain(OWN_ROWS);
      }
      expect(logged()).not.toContain(TOKEN);
    });

    it.each([401, 403, 404])(
      'answers forbidden when ADAS answers the required queries %i',
      async (status) => {
        analytics.setHandler(
          adas({ queries: { daily: { status }, ranking: { status } } }),
        );

        await expect(history()).resolves.toEqual({
          available: false,
          reason: 'forbidden',
        });
        expect(executed(analytics)).not.toContain('dailyModels');
        expect(logged()).toContain('configuration problem');
        expect(logged()).not.toContain(TOKEN);
      },
    );
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

      expect(analytics.requests).toHaveLength(5);
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
        expect(filter).toContain(OWN_ROWS);
      }
      expect(
        new Set(analytics.requests.map((r) => `${r.method} ${r.path}`)).size,
      ).toBe(2);
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

    it('answers zero totals and zero-filled days when ADAS returns no own rows', async () => {
      analytics.setHandler(
        adas({
          queries: { daily: rows(), ranking: rows(), clients: rows() },
        }),
      );

      await expect(history()).resolves.toMatchObject({
        available: true,
        totals: { spend: 0, requests: 0 },
        daily: [
          { date: '2026-11-01', spend: 0, requests: 0, byModel: {} },
          { date: '2026-11-02', spend: 0, requests: 0, byModel: {} },
          { date: '2026-11-03', spend: 0, requests: 0, byModel: {} },
        ],
        byModel: [],
      });
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
      ['daily totals answer 400', 'daily', { status: 400 }, 'forbidden'],
      ['the ranking answers 400', 'ranking', { status: 400 }, 'forbidden'],
      [
        'the per-day query answers 400 after the own-rows filter was accepted',
        'dailyModels',
        { status: 400 },
        'unavailable',
      ],
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
      expect(analytics.requests.length).toBeLessThanOrEqual(5);
    });

    it('refuses an ADAS that rejects the own-rows filter and never sends a query without it', async () => {
      const rejected: FakeResponse = { status: 400 };
      analytics.setHandler(
        adas({
          queries: {
            daily: rejected,
            ranking: rejected,
            dailyModels: rejected,
            clients: rejected,
          },
        }),
      );

      await expect(history()).resolves.toEqual({
        available: false,
        reason: 'forbidden',
      });
      const kinds = executed(analytics);
      expect(new Set(kinds).size).toBe(kinds.length);
      for (const filter of executedFilters(analytics)) {
        expect(filter).toContain(OWN_ROWS);
      }
      const warned = JSON.stringify(logs[2].mock.calls);
      expect(warned).toContain('ai-dial-analytics#86');
      expect(warned).toContain('column policy hides `user_hash`');
      expect(logged()).not.toContain(TOKEN);
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
      expect(logged()).toContain('client breakdown omitted');
    });
  });

  describe('budget scope', () => {
    const budgetHistory = () =>
      service.getUsageHistory(TOKEN, UsageHistoryPeriod.Month, BUDGET);

    const filters = (): string[] =>
      analytics.requests
        .filter((request) => request.path === '/v1/queries/execute')
        .map((request) =>
          JSON.stringify((request.body as { filter: unknown }).filter),
        );

    const selects = (): string[] =>
      analytics.requests
        .filter((request) => request.path === '/v1/queries/execute')
        .map((request) =>
          JSON.stringify((request.body as { select: unknown }).select),
        );

    it('narrows every query to the paid model calls of the budget and echoes it', async () => {
      analytics.setHandler(adas({ schema: SCHEMA_WITH_BUDGET }));

      await expect(budgetHistory()).resolves.toMatchObject({
        available: true,
        budget: BUDGET,
        totals: { spend: 1.234568, requests: 42 },
        byClient: [
          { client: 'chat', spend: 1, requests: 35 },
          { client: 'claudecode', spend: 0.234568, requests: 7 },
        ],
      });
      expect(executed(analytics).sort()).toEqual(
        ['clients', 'daily', 'dailyModels', 'ranking'].sort(),
      );
      for (const filter of filters()) {
        expect(filter).toContain(
          '{"op":"eq","args":[{"type":"field","name":"budget_cost_object"},{"type":"value","value_type":"string","value":"engineering"}]}',
        );
        expect(filter).toContain(
          '{"op":"eq","args":[{"type":"field","name":"budget_policy"},{"type":"value","value_type":"string","value":"policies/company/pro"}]}',
        );
        expect(filter).toContain(
          '{"op":"eq","args":[{"type":"field","name":"budget_outcome"},{"type":"value","value_type":"string","value":"paid"}]}',
        );
        expect(filter).not.toContain('parent_deployment');
        expect(filter).toContain(OWN_ROWS);
      }
      for (const select of selects()) {
        expect(select).toContain('"name":"deployment_price"');
        expect(select).not.toContain('total_price');
      }
    });

    it('answers budget_unsupported and runs no query without the budget columns', async () => {
      analytics.setHandler(adas({ schema: SCHEMA_WITH_CLIENT }));

      await expect(budgetHistory()).resolves.toEqual({
        available: false,
        reason: 'budget_unsupported',
      });
      expect(executed(analytics)).toEqual([]);
      expect(logged()).toContain('no budget columns');
    });

    it.each([
      [403, 'forbidden'],
      [502, 'unavailable'],
    ])(
      'answers %s schema reads with %s and runs no query',
      async (status, reason) => {
        analytics.setHandler(adas({ schema: { status } }));

        await expect(budgetHistory()).resolves.toEqual({
          available: false,
          reason,
        });
        expect(executed(analytics)).toEqual([]);
      },
    );

    it('does not echo a budget for the user scope', async () => {
      analytics.setHandler(adas({ schema: SCHEMA_WITH_BUDGET }));

      const result = await history();

      expect(result.available).toBe(true);
      expect('budget' in result).toBe(false);
      for (const filter of filters()) {
        expect(filter).toContain('parent_deployment');
        expect(filter).not.toContain('budget_');
      }
    });
  });
});
