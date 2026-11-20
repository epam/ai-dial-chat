import type { UsageWindow } from '../usage-period';

/*
 * The only DIAL Analytics (ADAS) structured queries the usage history route
 * sends (POST /v1/queries/execute). Each document is fixed: only the window's
 * epoch-millisecond timestamp literals and, for the per-day model query, the
 * deployment names ADAS itself returned vary, and for a budget scope its cost
 * object and policy (validated request input, sent only as string literals).
 * Two mechanisms confine the rows to the caller: the ADAS row policies of the
 * caller's read, and OWN_ROWS_PREDICATE in every filter, a caller value ADAS
 * resolves from the request's own token (ai-dial-analytics#86), so the BFF
 * never sees a user hash. There is no SQL. Aliases carry a `usage_` prefix
 * because ADAS rejects an alias equal to a column name that projects another
 * expression. See openspec/changes/archive/2026-11-20-add-user-usage-history-api/design.md (D3)
 * and openspec/changes/archive/2026-11-20-filter-usage-history-own-rows/design.md (D1).
 */

const ENTITY = 'dial_usage_log';

export const DAILY_TOTALS_LIMIT = 31;
export const MODEL_RANKING_LIMIT = 1000;
export const TOP_MODEL_COUNT = 10;
export const DAILY_TOP_MODELS_LIMIT = DAILY_TOTALS_LIMIT * TOP_MODEL_COUNT;
export const CLIENT_SPLIT_LIMIT = 100;

/** Field name of the client type contributed by the `usage_client_identity` enrichment. */
export const CLIENT_TYPE_FIELD = 'usage_client_identity.client_type';

export const DAY_ALIAS = 'usage_day';
export const SPEND_ALIAS = 'usage_spend';
export const REQUESTS_ALIAS = 'usage_requests';
export const CLIENT_ALIAS = 'usage_client';
export const SPEND_RANK_ALIAS = 'usage_spend_rank';
export const DEPLOYMENT_FIELD = 'deployment';

/*
 * The charged budget DIAL Core writes on model rows (ai-dial-core#2308), as
 * ADAS columns (ai-dial-analytics V18). Application and router rows carry
 * none, and a budget's spend is the sum of `deployment_price` over its rows.
 */
export const BUDGET_COST_OBJECT_FIELD = 'budget_cost_object';
export const BUDGET_POLICY_FIELD = 'budget_policy';
export const BUDGET_OUTCOME_FIELD = 'budget_outcome';
export const BUDGET_FIELDS = [
  BUDGET_COST_OBJECT_FIELD,
  BUDGET_POLICY_FIELD,
  BUDGET_OUTCOME_FIELD,
] as const;
/** The outcome of a call a budget paid for; the other outcomes charge nothing. */
export const PAID_OUTCOME = 'paid';

/** A budget the queries are narrowed to: one policy of one cost object. */
export interface UsageBudget {
  costObject: string;
  policy: string;
}

const field = (name: string) => ({ type: 'field', name });

const fn = (name: string, ...args: object[]) => ({ type: 'fn', name, args });

const stringValue = (value: string) => ({
  type: 'value',
  value_type: 'string',
  value,
});

const timestampValue = (instant: Date) => ({
  type: 'value',
  value_type: 'timestamp',
  value: String(instant.getTime()),
});

/* `eq` against a null literal renders `IS NULL` in ADAS. */
const ROOT_SPAN_PREDICATE = {
  op: 'eq',
  args: [
    field('parent_deployment'),
    { type: 'value', value_type: 'null', value: null },
  ],
};

/**
 * The caller's own rows: ADAS compares `user_hash` with the hash of whoever
 * runs the query, so a caller whose role reads every row (an administrator)
 * still gets only its own, and a caller without a hash matches no row. A
 * top-level conjunct of every filter, so nothing else in it can widen it.
 */
export const OWN_ROWS_PREDICATE = {
  op: 'eq',
  args: [field('user_hash'), { type: 'param', name: 'caller.user_hash' }],
};

const equals = (name: string, value: string) => ({
  op: 'eq',
  args: [field(name), stringValue(value)],
});

/*
 * User scope counts each request once, on its root span. Budget scope counts
 * the model rows the budget paid for, wherever they sit in the chain.
 */
const scopePredicates = (budget?: UsageBudget): object[] =>
  budget
    ? [
        equals(BUDGET_COST_OBJECT_FIELD, budget.costObject),
        equals(BUDGET_POLICY_FIELD, budget.policy),
        equals(BUDGET_OUTCOME_FIELD, PAID_OUTCOME),
      ]
    : [ROOT_SPAN_PREDICATE];

const windowFilter = (
  window: UsageWindow,
  budget: UsageBudget | undefined,
  ...extra: object[]
) => ({
  op: 'and',
  args: [
    { op: 'ge', args: [field('request_time'), timestampValue(window.from)] },
    { op: 'lt', args: [field('request_time'), timestampValue(window.to)] },
    OWN_ROWS_PREDICATE,
    ...scopePredicates(budget),
    ...extra,
  ],
});

/*
 * A root span's `total_price` includes the calls it made; a model row's
 * `deployment_price` is what its budget was charged.
 */
const priceField = (budget?: UsageBudget) =>
  field(budget ? 'deployment_price' : 'total_price');

const DAY_SELECT = {
  expr: fn(
    'to_string',
    fn('date_trunc', stringValue('day'), field('request_time')),
  ),
  as: DAY_ALIAS,
};

/* `to_string` returns the exact decimal text, so money is never a float in transit. */
const spendSelect = (budget?: UsageBudget) => ({
  expr: fn('to_string', fn('sum', priceField(budget))),
  as: SPEND_ALIAS,
});

/*
 * Numeric twin of SPEND_SELECT, used only to sort: sorting the decimal text
 * would order "10.5" before "9.1".
 */
const spendRankSelect = (budget?: UsageBudget) => ({
  expr: fn('sum', priceField(budget)),
  as: SPEND_RANK_ALIAS,
});

const REQUESTS_SELECT = { expr: fn('count'), as: REQUESTS_ALIAS };

const page = (limit: number) => ({ type: 'offset', offset: 0, limit });

/** Q1: spend and requests per UTC day of the window. */
export const buildDailyTotalsQuery = (
  window: UsageWindow,
  budget?: UsageBudget,
) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window, budget),
  select: [DAY_SELECT, spendSelect(budget), REQUESTS_SELECT],
  group_by: [DAY_ALIAS],
  sort: [{ field: DAY_ALIAS, dir: 'asc' }],
  page: page(DAILY_TOTALS_LIMIT),
});

/** Q2: every root deployment of the window, ranked by spend. */
export const buildModelRankingQuery = (
  window: UsageWindow,
  budget?: UsageBudget,
) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window, budget),
  select: [
    { expr: field(DEPLOYMENT_FIELD), as: DEPLOYMENT_FIELD },
    spendSelect(budget),
    spendRankSelect(budget),
    REQUESTS_SELECT,
  ],
  group_by: [DEPLOYMENT_FIELD],
  sort: [
    { field: SPEND_RANK_ALIAS, dir: 'desc', nulls: 'last' },
    { field: REQUESTS_ALIAS, dir: 'desc' },
    { field: DEPLOYMENT_FIELD, dir: 'asc' },
  ],
  page: page(MODEL_RANKING_LIMIT),
});

/** Q3: spend and requests per UTC day for the already-ranked top deployments. */
export const buildDailyTopModelsQuery = (
  window: UsageWindow,
  deployments: readonly string[],
  budget?: UsageBudget,
) => {
  if (deployments.length === 0 || deployments.length > TOP_MODEL_COUNT) {
    throw new Error(
      `The per-day model query takes 1 to ${TOP_MODEL_COUNT} deployments, got ${deployments.length}`,
    );
  }
  return {
    entity: ENTITY,
    mode: 'aggregate',
    filter: windowFilter(window, budget, {
      op: 'in',
      args: [
        field(DEPLOYMENT_FIELD),
        { type: 'array', items: deployments.map(stringValue) },
      ],
    }),
    select: [
      DAY_SELECT,
      { expr: field(DEPLOYMENT_FIELD), as: DEPLOYMENT_FIELD },
      spendSelect(budget),
      REQUESTS_SELECT,
    ],
    group_by: [DAY_ALIAS, DEPLOYMENT_FIELD],
    sort: [
      { field: DAY_ALIAS, dir: 'asc' },
      { field: DEPLOYMENT_FIELD, dir: 'asc' },
    ],
    page: page(DAILY_TOP_MODELS_LIMIT),
  };
};

/** Q4: spend and requests per client type from the client-identity enrichment. */
export const buildClientSplitQuery = (
  window: UsageWindow,
  budget?: UsageBudget,
) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window, budget),
  select: [
    { expr: field(CLIENT_TYPE_FIELD), as: CLIENT_ALIAS },
    spendSelect(budget),
    spendRankSelect(budget),
    REQUESTS_SELECT,
  ],
  group_by: [CLIENT_ALIAS],
  sort: [{ field: SPEND_RANK_ALIAS, dir: 'desc', nulls: 'last' }],
  page: page(CLIENT_SPLIT_LIMIT),
});
