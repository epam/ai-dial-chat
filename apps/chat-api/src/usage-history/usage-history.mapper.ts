import type { AnalyticsComponents } from '@epam/ai-dial-typescript-sdk';
import type {
  UsageHistoryClientEntryDto,
  UsageHistoryDailyEntryDto,
  UsageHistoryModelEntryDto,
  UserUsageHistoryResponseDto,
} from './dto/user-usage-history-response.dto';
import {
  CLIENT_ALIAS,
  DAY_ALIAS,
  DEPLOYMENT_FIELD,
  REQUESTS_ALIAS,
  SPEND_ALIAS,
  TOP_MODEL_COUNT,
  type UsageBudget,
} from './queries/usage-history.queries';
import type { UsageHistoryPeriod } from './types/usage-history-period';
import type { UsageWindow } from './usage-period';

/** Name of the remainder entry beyond the top deployments. */
export const OTHER_DEPLOYMENT = 'other';
/** Client name for root spans the client-identity enrichment has no value for. */
export const UNKNOWN_CLIENT = 'unknown';
export const USAGE_CURRENCY = 'USD';

/** An ADAS response that does not have the shape the fixed queries produce. */
export class UsageHistoryMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = UsageHistoryMappingError.name;
  }
}

/*
 * Money is kept as a bigint count of 10^-12 USD, the scale of ADAS'
 * Decimal(38, 12), so sums and remainders are exact; it is rounded once per
 * output value.
 */
const PICOS_PER_MICRO = 1_000_000n;
const MONEY_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;
const COUNT_PATTERN = /^\d+$/;
/*
 * ADAS renders `to_string` as ClickHouse `toString`, so the day bucket's text
 * follows the type `toStartOfInterval(…, INTERVAL 1 DAY, 'UTC')` returns:
 * `Date` (`2026-11-02`), `DateTime` (`2026-11-02 00:00:00`) or `DateTime64`
 * (`2026-11-02 00:00:00.000`). All three are midnight of the same date.
 */
const DAY_PATTERN = /^(\d{4}-\d{2}-\d{2})(?: 00:00:00(?:\.0{1,9})?)?$/;

interface Usage {
  spend: bigint;
  requests: number;
}

/** An ADAS query response, as the SDK types it (not validated). */
type StructuredQueryResultDto =
  AnalyticsComponents['schemas']['StructuredQueryResultDto'];

type Row = Record<string, unknown>;

const ZERO: Usage = { spend: 0n, requests: 0 };

const addUsage = (a: Usage, b: Usage): Usage => ({
  spend: a.spend + b.spend,
  requests: a.requests + b.requests,
});

const isEmptyUsage = (usage: Usage): boolean =>
  usage.spend === 0n && usage.requests === 0;

/* A later query may see rows ingested after an earlier one; a remainder never goes negative. */
const remainder = (total: Usage, part: Usage): Usage => ({
  spend: total.spend > part.spend ? total.spend - part.spend : 0n,
  requests: Math.max(total.requests - part.requests, 0),
});

const roundHalfAwayFromZero = (value: bigint, step: bigint): bigint => {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  let quotient = magnitude / step;
  if ((magnitude % step) * 2n >= step) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
};

/** Rounds picodollars half away from zero to 6 decimal places. */
export const toRoundedSpend = (picos: bigint): number =>
  Number(roundHalfAwayFromZero(picos, PICOS_PER_MICRO)) / 1_000_000;

/**
 * Parses ADAS' decimal text (or null, a sum over no price) into picodollars.
 * Only text is accepted: the queries select money through `to_string`, so a
 * number here means the response shape changed, and a float would silently
 * bring back the imprecision this parser exists to avoid.
 */
export const parseSpend = (cell: unknown): bigint => {
  if (cell == null) return 0n;
  const match = typeof cell === 'string' ? MONEY_PATTERN.exec(cell) : null;
  if (!match) {
    throw new UsageHistoryMappingError('A spend cell is not a decimal number');
  }
  const [, sign, whole, fraction = ''] = match;
  /* Scale to 18 fraction digits, then round to the 12 ADAS stores. */
  const atom = BigInt(whole + fraction.padEnd(18, '0').slice(0, 18));
  const picos = roundHalfAwayFromZero(atom, 1_000_000n);
  return sign === '-' ? -picos : picos;
};

const parseRequests = (cell: unknown): number => {
  const value =
    typeof cell === 'string' && COUNT_PATTERN.test(cell) ? Number(cell) : cell;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new UsageHistoryMappingError('A request-count cell is not a count');
  }
  return value;
};

const parseDay = (cell: unknown, dates: ReadonlySet<string>): string => {
  const match = typeof cell === 'string' ? DAY_PATTERN.exec(cell) : null;
  if (!match || !dates.has(match[1])) {
    throw new UsageHistoryMappingError('A day cell is outside the window');
  }
  return match[1];
};

const parseName = (cell: unknown, what: string): string => {
  if (typeof cell !== 'string' || cell.length === 0) {
    throw new UsageHistoryMappingError(`A ${what} cell is not a name`);
  }
  return cell;
};

const parseUsage = (row: Row): Usage => ({
  spend: parseSpend(row[SPEND_ALIAS]),
  requests: parseRequests(row[REQUESTS_ALIAS]),
});

/**
 * The `rows` of an ADAS query response. The SDK types the body but does not
 * validate it, so the list and each row are checked; cell values are checked
 * by the parsers that read them.
 */
export const readRows = (body: StructuredQueryResultDto): Row[] => {
  const { rows } = body;
  if (
    !Array.isArray(rows) ||
    !rows.every((row) => row != null && typeof row === 'object')
  ) {
    throw new UsageHistoryMappingError('The query response has no rows');
  }
  return rows;
};

interface RankedDeployment extends Usage {
  deployment: string;
}

const byUsageThenName = <T extends Usage>(
  nameOf: (entry: T) => string,
): ((a: T, b: T) => number) => {
  return (a, b) => {
    if (a.spend !== b.spend) return a.spend > b.spend ? -1 : 1;
    if (a.requests !== b.requests) return b.requests - a.requests;
    return nameOf(a).localeCompare(nameOf(b));
  };
};

/** Q2 rows → deployments in rank order. */
export const rankDeployments = (
  rankingBody: StructuredQueryResultDto,
): RankedDeployment[] =>
  readRows(rankingBody)
    .map((row) => ({
      deployment: parseName(row[DEPLOYMENT_FIELD], 'deployment'),
      ...parseUsage(row),
    }))
    .sort(byUsageThenName((entry) => entry.deployment));

/**
 * The named deployments of `byModel`: the top 10, or every one when there are
 * at most 10. When a remainder exists, a real deployment called `other` is
 * folded into it so the `other` key stays unambiguous.
 */
export const selectTopDeployments = (
  ranked: readonly RankedDeployment[],
): RankedDeployment[] => {
  if (ranked.length <= TOP_MODEL_COUNT) return [...ranked];
  return ranked
    .filter((entry) => entry.deployment !== OTHER_DEPLOYMENT)
    .slice(0, TOP_MODEL_COUNT);
};

export interface UsageHistorySources {
  period: UsageHistoryPeriod;
  window: UsageWindow;
  /** The budget every query was narrowed to; absent for the user's whole history. */
  budget?: UsageBudget;
  /** Q1 response. */
  dailyTotals: StructuredQueryResultDto;
  /** Q2 rows, already ranked. */
  ranked: readonly RankedDeployment[];
  /** Q3 response; absent when Q2 returned no deployment. */
  dailyTopModels?: StructuredQueryResultDto;
  /** Q4 response; absent when the enrichment is unavailable. */
  clientSplit?: StructuredQueryResultDto;
}

const mapDailyTotals = (
  body: StructuredQueryResultDto,
  dates: ReadonlySet<string>,
): Map<string, Usage> => {
  const byDate = new Map<string, Usage>();
  for (const row of readRows(body)) {
    const date = parseDay(row[DAY_ALIAS], dates);
    byDate.set(date, addUsage(byDate.get(date) ?? ZERO, parseUsage(row)));
  }
  return byDate;
};

const mapDailyTopModels = (
  body: StructuredQueryResultDto,
  dates: ReadonlySet<string>,
  topNames: ReadonlySet<string>,
): Map<string, Map<string, Usage>> => {
  const byDate = new Map<string, Map<string, Usage>>();
  for (const row of readRows(body)) {
    const date = parseDay(row[DAY_ALIAS], dates);
    const deployment = parseName(row[DEPLOYMENT_FIELD], 'deployment');
    if (!topNames.has(deployment)) {
      throw new UsageHistoryMappingError(
        'A per-day model row names a deployment that was not requested',
      );
    }
    const day = byDate.get(date) ?? new Map<string, Usage>();
    day.set(deployment, addUsage(day.get(deployment) ?? ZERO, parseUsage(row)));
    byDate.set(date, day);
  }
  return byDate;
};

/** Q4 rows → clients by spend, with missing enrichment values merged into `unknown`. */
export const mapClientSplit = (
  body: StructuredQueryResultDto,
): UsageHistoryClientEntryDto[] => {
  const byClient = new Map<string, Usage>();
  for (const row of readRows(body)) {
    const raw = row[CLIENT_ALIAS];
    if (raw != null && typeof raw !== 'string') {
      throw new UsageHistoryMappingError('A client cell is not a name');
    }
    const client = raw ? raw : UNKNOWN_CLIENT;
    byClient.set(
      client,
      addUsage(byClient.get(client) ?? ZERO, parseUsage(row)),
    );
  }
  return [...byClient.entries()]
    .map(([client, usage]) => ({ client, ...usage }))
    .sort(byUsageThenName((entry) => entry.client))
    .map(({ client, spend, requests }) => ({
      client,
      spend: toRoundedSpend(spend),
      requests,
    }));
};

/** Builds the `available: true` response from the ADAS query results. */
export const buildAvailableHistory = (
  sources: UsageHistorySources,
): UserUsageHistoryResponseDto => {
  const dates = new Set(sources.window.dates);
  const dailyTotals = mapDailyTotals(sources.dailyTotals, dates);
  const totals = [...dailyTotals.values()].reduce(addUsage, ZERO);

  const top = selectTopDeployments(sources.ranked);
  const topNames = new Set(top.map((entry) => entry.deployment));
  const hasOther = sources.ranked.length > TOP_MODEL_COUNT;
  const dailyTopModels =
    sources.dailyTopModels === undefined
      ? new Map<string, Map<string, Usage>>()
      : mapDailyTopModels(sources.dailyTopModels, dates, topNames);

  const byModel: UsageHistoryModelEntryDto[] = top.map((entry) => ({
    deployment: entry.deployment,
    spend: toRoundedSpend(entry.spend),
    requests: entry.requests,
  }));
  if (hasOther) {
    const other = remainder(totals, top.reduce(addUsage, ZERO));
    byModel.push({
      deployment: OTHER_DEPLOYMENT,
      spend: toRoundedSpend(other.spend),
      requests: other.requests,
    });
  }

  const daily: UsageHistoryDailyEntryDto[] = sources.window.dates.map(
    (date) => {
      const dayTotal = dailyTotals.get(date) ?? ZERO;
      const dayModels = dailyTopModels.get(date) ?? new Map<string, Usage>();
      const byModelOfDay: Record<string, number> = {};
      for (const entry of top) {
        const usage = dayModels.get(entry.deployment);
        if (usage && !isEmptyUsage(usage)) {
          byModelOfDay[entry.deployment] = toRoundedSpend(usage.spend);
        }
      }
      if (hasOther) {
        const other = remainder(
          dayTotal,
          [...dayModels.values()].reduce(addUsage, ZERO),
        );
        if (!isEmptyUsage(other)) {
          byModelOfDay[OTHER_DEPLOYMENT] = toRoundedSpend(other.spend);
        }
      }
      return {
        date,
        spend: toRoundedSpend(dayTotal.spend),
        requests: dayTotal.requests,
        byModel: byModelOfDay,
      };
    },
  );

  return {
    available: true,
    period: {
      name: sources.period,
      from: sources.window.from.toISOString(),
      to: sources.window.to.toISOString(),
    },
    ...(sources.budget === undefined
      ? {}
      : {
          budget: {
            costObject: sources.budget.costObject,
            policy: sources.budget.policy,
          },
        }),
    currency: USAGE_CURRENCY,
    totals: { spend: toRoundedSpend(totals.spend), requests: totals.requests },
    daily,
    byModel,
    ...(sources.clientSplit === undefined
      ? {}
      : { byClient: mapClientSplit(sources.clientSplit) }),
  };
};
