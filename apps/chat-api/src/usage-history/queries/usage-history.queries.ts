import type { UsageWindow } from '../usage-period';

/*
 * The only DIAL Analytics (ADAS) structured queries the usage history route
 * sends (POST /v1/queries/execute). Each document is fixed: only the window's
 * epoch-millisecond timestamp literals and, for the per-day model query, the
 * deployment names ADAS itself returned vary. There is no user filter — the
 * ADAS row policy confines the rows — and no SQL. Aliases carry a `usage_`
 * prefix because ADAS rejects an alias equal to a column name that projects
 * another expression. See
 * openspec/changes/add-user-usage-history-api/design.md (D3).
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

const windowFilter = (window: UsageWindow, ...extra: object[]) => ({
  op: 'and',
  args: [
    { op: 'ge', args: [field('request_time'), timestampValue(window.from)] },
    { op: 'lt', args: [field('request_time'), timestampValue(window.to)] },
    ROOT_SPAN_PREDICATE,
    ...extra,
  ],
});

const DAY_SELECT = {
  expr: fn(
    'to_string',
    fn('date_trunc', stringValue('day'), field('request_time')),
  ),
  as: DAY_ALIAS,
};

/* `to_string` returns the exact decimal text, so money is never a float in transit. */
const SPEND_SELECT = {
  expr: fn('to_string', fn('sum', field('total_price'))),
  as: SPEND_ALIAS,
};

/*
 * Numeric twin of SPEND_SELECT, used only to sort: sorting the decimal text
 * would order "10.5" before "9.1".
 */
const SPEND_RANK_SELECT = {
  expr: fn('sum', field('total_price')),
  as: SPEND_RANK_ALIAS,
};

const REQUESTS_SELECT = { expr: fn('count'), as: REQUESTS_ALIAS };

const page = (limit: number) => ({ type: 'offset', offset: 0, limit });

/** Q1: spend and requests per UTC day of the window. */
export const buildDailyTotalsQuery = (window: UsageWindow) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window),
  select: [DAY_SELECT, SPEND_SELECT, REQUESTS_SELECT],
  group_by: [DAY_ALIAS],
  sort: [{ field: DAY_ALIAS, dir: 'asc' }],
  page: page(DAILY_TOTALS_LIMIT),
});

/** Q2: every root deployment of the window, ranked by spend. */
export const buildModelRankingQuery = (window: UsageWindow) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window),
  select: [
    { expr: field(DEPLOYMENT_FIELD), as: DEPLOYMENT_FIELD },
    SPEND_SELECT,
    SPEND_RANK_SELECT,
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
) => {
  if (deployments.length === 0 || deployments.length > TOP_MODEL_COUNT) {
    throw new Error(
      `The per-day model query takes 1 to ${TOP_MODEL_COUNT} deployments, got ${deployments.length}`,
    );
  }
  return {
    entity: ENTITY,
    mode: 'aggregate',
    filter: windowFilter(window, {
      op: 'in',
      args: [
        field(DEPLOYMENT_FIELD),
        { type: 'array', items: deployments.map(stringValue) },
      ],
    }),
    select: [
      DAY_SELECT,
      { expr: field(DEPLOYMENT_FIELD), as: DEPLOYMENT_FIELD },
      SPEND_SELECT,
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
export const buildClientSplitQuery = (window: UsageWindow) => ({
  entity: ENTITY,
  mode: 'aggregate',
  filter: windowFilter(window),
  select: [
    { expr: field(CLIENT_TYPE_FIELD), as: CLIENT_ALIAS },
    SPEND_SELECT,
    SPEND_RANK_SELECT,
    REQUESTS_SELECT,
  ],
  group_by: [CLIENT_ALIAS],
  sort: [{ field: SPEND_RANK_ALIAS, dir: 'desc', nulls: 'last' }],
  page: page(CLIENT_SPLIT_LIMIT),
});
