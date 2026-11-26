import { describe, expect, it } from 'vitest';
import {
  buildClientSplitQuery,
  buildDailyTopModelsQuery,
  buildDailyTotalsQuery,
  buildModelRankingQuery,
  OWN_ROWS_PREDICATE,
  type UsageBudget,
} from '../queries/usage-history.queries';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import { resolveUsageWindow } from '../usage-period';

const NOW = new Date('2026-11-18T14:05:09.120Z');
const MONTH = resolveUsageWindow(UsageHistoryPeriod.Month, NOW);
const FROM_MS = String(Date.parse('2026-11-01T00:00:00.000Z'));
const TO_MS = String(NOW.getTime());

const field = (name: string) => ({ type: 'field', name });

const WINDOW_AND_ROOT = [
  {
    op: 'ge',
    args: [
      field('request_time'),
      { type: 'value', value_type: 'timestamp', value: FROM_MS },
    ],
  },
  {
    op: 'lt',
    args: [
      field('request_time'),
      { type: 'value', value_type: 'timestamp', value: TO_MS },
    ],
  },
  {
    op: 'eq',
    args: [field('user_hash'), { type: 'param', name: 'caller.user_hash' }],
  },
  {
    op: 'eq',
    args: [
      field('parent_deployment'),
      { type: 'value', value_type: 'null', value: null },
    ],
  },
];

const DAY = {
  expr: {
    type: 'fn',
    name: 'to_string',
    args: [
      {
        type: 'fn',
        name: 'date_trunc',
        args: [
          { type: 'value', value_type: 'string', value: 'day' },
          field('request_time'),
        ],
      },
    ],
  },
  as: 'usage_day',
};

const SPEND = {
  expr: {
    type: 'fn',
    name: 'to_string',
    args: [{ type: 'fn', name: 'sum', args: [field('total_price')] }],
  },
  as: 'usage_spend',
};

const SPEND_RANK = {
  expr: { type: 'fn', name: 'sum', args: [field('total_price')] },
  as: 'usage_spend_rank',
};

const REQUESTS = {
  expr: { type: 'fn', name: 'count', args: [] },
  as: 'usage_requests',
};

const BUDGET: UsageBudget = {
  costObject: 'engineering',
  policy: 'policies/company/pro',
};

const ALL_QUERIES = (window = MONTH, budget?: UsageBudget) => [
  buildDailyTotalsQuery(window, budget),
  buildModelRankingQuery(window, budget),
  buildDailyTopModelsQuery(window, ['gpt-4o'], budget),
  buildClientSplitQuery(window, budget),
];

/* Every `eq`/`ne` that compares `user_hash` with anything, at any depth. */
const userHashComparisons = (node: unknown): unknown[] => {
  if (Array.isArray(node)) return node.flatMap(userHashComparisons);
  if (node == null || typeof node !== 'object') return [];
  const { op, args } = node as { op?: unknown; args?: unknown };
  const isUserHashComparison =
    (op === 'eq' || op === 'ne') &&
    Array.isArray(args) &&
    args.some(
      (arg) =>
        (arg as { type?: unknown; name?: unknown })?.type === 'field' &&
        (arg as { name?: unknown }).name === 'user_hash',
    );
  return [
    ...(isUserHashComparison ? [node] : []),
    ...Object.values(node).flatMap(userHashComparisons),
  ];
};

describe('usage history queries', () => {
  it('builds the daily totals query', () => {
    expect(buildDailyTotalsQuery(MONTH)).toEqual({
      entity: 'dial_usage_log',
      mode: 'aggregate',
      filter: { op: 'and', args: WINDOW_AND_ROOT },
      select: [DAY, SPEND, REQUESTS],
      group_by: ['usage_day'],
      sort: [{ field: 'usage_day', dir: 'asc' }],
      page: { type: 'offset', offset: 0, limit: 31 },
    });
  });

  it('builds the model ranking query, sorted by numeric spend', () => {
    expect(buildModelRankingQuery(MONTH)).toEqual({
      entity: 'dial_usage_log',
      mode: 'aggregate',
      filter: { op: 'and', args: WINDOW_AND_ROOT },
      select: [
        { expr: field('deployment'), as: 'deployment' },
        SPEND,
        SPEND_RANK,
        REQUESTS,
      ],
      group_by: ['deployment'],
      sort: [
        { field: 'usage_spend_rank', dir: 'desc', nulls: 'last' },
        { field: 'usage_requests', dir: 'desc' },
        { field: 'deployment', dir: 'asc' },
      ],
      page: { type: 'offset', offset: 0, limit: 1000 },
    });
  });

  it('builds the per-day top models query with the ranked names as string literals', () => {
    expect(buildDailyTopModelsQuery(MONTH, ['gpt-4o', "o'brien"])).toEqual({
      entity: 'dial_usage_log',
      mode: 'aggregate',
      filter: {
        op: 'and',
        args: [
          ...WINDOW_AND_ROOT,
          {
            op: 'in',
            args: [
              field('deployment'),
              {
                type: 'array',
                items: [
                  { type: 'value', value_type: 'string', value: 'gpt-4o' },
                  { type: 'value', value_type: 'string', value: "o'brien" },
                ],
              },
            ],
          },
        ],
      },
      select: [
        DAY,
        { expr: field('deployment'), as: 'deployment' },
        SPEND,
        REQUESTS,
      ],
      group_by: ['usage_day', 'deployment'],
      sort: [
        { field: 'usage_day', dir: 'asc' },
        { field: 'deployment', dir: 'asc' },
      ],
      page: { type: 'offset', offset: 0, limit: 310 },
    });
  });

  it('builds the client split query over the enrichment field', () => {
    expect(buildClientSplitQuery(MONTH)).toEqual({
      entity: 'dial_usage_log',
      mode: 'aggregate',
      filter: { op: 'and', args: WINDOW_AND_ROOT },
      select: [
        {
          expr: field('usage_client_identity.client_type'),
          as: 'usage_client',
        },
        SPEND,
        SPEND_RANK,
        REQUESTS,
      ],
      group_by: ['usage_client'],
      sort: [{ field: 'usage_spend_rank', dir: 'desc', nulls: 'last' }],
      page: { type: 'offset', offset: 0, limit: 100 },
    });
  });

  it('differs between periods only in the timestamp literal values', () => {
    const today = resolveUsageWindow(UsageHistoryPeriod.Today, NOW);
    const stripTimestamps = (query: object) =>
      JSON.stringify(query).replace(
        /"value_type":"timestamp","value":"\d+"/g,
        '"value_type":"timestamp","value":"<ms>"',
      );

    expect(ALL_QUERIES(today).map(stripTimestamps)).toEqual(
      ALL_QUERIES(MONTH).map(stripTimestamps),
    );
    expect(JSON.stringify(ALL_QUERIES(today))).not.toEqual(
      JSON.stringify(ALL_QUERIES(MONTH)),
    );
  });

  it.each([
    ['user scope', undefined],
    ['budget scope', BUDGET],
  ])(
    'confines every query of the %s to the caller own rows with the caller value',
    (_label, budget) => {
      for (const query of ALL_QUERIES(MONTH, budget)) {
        expect(query.filter.op).toBe('and');
        expect(query.filter.args).toContainEqual(OWN_ROWS_PREDICATE);
        expect(userHashComparisons(query)).toEqual([OWN_ROWS_PREDICATE]);
      }
    },
  );

  it('filters the client split on the usage log field, not the enrichment', () => {
    const { filter } = buildClientSplitQuery(MONTH);

    expect(filter.args).toContainEqual({
      op: 'eq',
      args: [field('user_hash'), { type: 'param', name: 'caller.user_hash' }],
    });
    expect(JSON.stringify(filter)).not.toContain('usage_client_identity');
  });

  it('holds no user identifier as a literal', () => {
    const serialized = JSON.stringify([
      ...ALL_QUERIES(),
      ...ALL_QUERIES(MONTH, BUDGET),
    ]);

    for (const identifier of ['user_ref', 'user_email', 'jwt_']) {
      expect(serialized).not.toContain(identifier);
    }
  });

  it('builds the budget-scope daily totals query over the paid model rows', () => {
    const budgetEquals = (name: string, value: string) => ({
      op: 'eq',
      args: [field(name), { type: 'value', value_type: 'string', value }],
    });

    expect(buildDailyTotalsQuery(MONTH, BUDGET)).toEqual({
      entity: 'dial_usage_log',
      mode: 'aggregate',
      filter: {
        op: 'and',
        args: [
          ...WINDOW_AND_ROOT.slice(0, 3),
          budgetEquals('budget_cost_object', 'engineering'),
          budgetEquals('budget_policy', 'policies/company/pro'),
          budgetEquals('budget_outcome', 'paid'),
        ],
      },
      select: [
        DAY,
        {
          expr: {
            type: 'fn',
            name: 'to_string',
            args: [
              { type: 'fn', name: 'sum', args: [field('deployment_price')] },
            ],
          },
          as: 'usage_spend',
        },
        REQUESTS,
      ],
      group_by: ['usage_day'],
      sort: [{ field: 'usage_day', dir: 'asc' }],
      page: { type: 'offset', offset: 0, limit: 31 },
    });
  });

  it.each([0, 11])(
    'refuses a per-day model query for %i deployments',
    (count) => {
      const names = Array.from({ length: count }, (_, index) => `m-${index}`);

      expect(() => buildDailyTopModelsQuery(MONTH, names)).toThrow(
        /1 to 10 deployments/,
      );
    },
  );
});
