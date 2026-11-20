import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AnalyticsClient } from './analytics/analytics.client';
import type { UserUsageHistoryResponseDto } from './dto/user-usage-history-response.dto';
import {
  buildClientSplitQuery,
  buildDailyTopModelsQuery,
  buildDailyTotalsQuery,
  buildModelRankingQuery,
  BUDGET_FIELDS,
  CLIENT_TYPE_FIELD,
  type UsageBudget,
} from './queries/usage-history.queries';
import type { UsageHistoryPeriod } from './types/usage-history-period';
import { UsageHistoryUnavailableReason } from './types/usage-history-unavailable-reason';
import {
  buildAvailableHistory,
  rankDeployments,
  selectTopDeployments,
} from './usage-history.mapper';
import { resolveUsageWindow, type UsageWindow } from './usage-period';

const FORBIDDEN_HINT =
  'check the ADAS identity providers (issuer, jwk-set-uri, audiences) for the BFF sign-in ' +
  'providers and the `*` read grant on dial_usage_log';

const OWN_ROWS_HINT =
  'every usage query filters on `user_hash = caller.user_hash`, so ADAS rejects it when it is ' +
  'older than 0.24 (no query caller values, ai-dial-analytics#86) or when a column policy hides ' +
  '`user_hash` from the caller; no query is sent without the filter';

const unavailable = (
  reason: UsageHistoryUnavailableReason,
): UserUsageHistoryResponseDto => ({ available: false, reason });

/* An identifier for logs: never the token, a body or a row value. */
const describeError = (error: unknown): string => {
  if (error instanceof HttpException) {
    return `${error.constructor.name} (${error.getStatus()})`;
  }
  return error instanceof Error ? error.name : 'unknown error';
};

/*
 * Outcome of schema discovery: whether the client-identity field and the
 * budget columns are visible; `error` is set when the schema read failed.
 */
interface SchemaDiscovery {
  exposed: boolean;
  budgetColumns: boolean;
  error?: unknown;
}

const isRefusal = (error: unknown): boolean =>
  error instanceof UnauthorizedException || error instanceof ForbiddenException;

/* The field names the caller's schema of the usage log lists. */
const schemaFieldNames = (schema: unknown): Set<string> => {
  const fields =
    schema != null && typeof schema === 'object'
      ? (schema as { fields?: unknown }).fields
      : undefined;
  const names = new Set<string>();
  if (!Array.isArray(fields)) return names;
  for (const entry of fields) {
    const name =
      entry != null && typeof entry === 'object'
        ? (entry as { name?: unknown }).name
        : undefined;
    if (typeof name === 'string') names.add(name);
  }
  return names;
};

const discover = (schema: unknown): SchemaDiscovery => {
  const names = schemaFieldNames(schema);
  return {
    exposed: names.has(CLIENT_TYPE_FIELD),
    budgetColumns: BUDGET_FIELDS.every((name) => names.has(name)),
  };
};

/**
 * Builds the signed-in user's usage history from DIAL Analytics (ADAS) with
 * the caller's own token. Every query is confined to the caller's own rows by
 * the ADAS caller value `caller.user_hash`, on top of the caller's row
 * policies. Every failure becomes an `available: false` body with a reason,
 * never an HTTP error, and partial data is never returned. See
 * openspec/changes/archive/2026-11-20-add-user-usage-history-api/design.md (D4, D6) and
 * openspec/changes/archive/2026-11-20-filter-usage-history-own-rows/design.md (D2, D3).
 */
@Injectable()
export class UsageHistoryService {
  private readonly logger = new Logger(UsageHistoryService.name);

  constructor(private readonly analytics: AnalyticsClient) {}

  /**
   * @param budget narrows every figure to the model calls this budget paid
   * for; without it the history covers all of the caller's root requests.
   */
  async getUsageHistory(
    accessToken: string,
    period: UsageHistoryPeriod,
    budget?: UsageBudget,
  ): Promise<UserUsageHistoryResponseDto> {
    if (!this.analytics.isConfigured) {
      this.logger.debug(
        `Usage history (${period}) not configured: ANALYTICS_URL is unset`,
      );
      return unavailable(UsageHistoryUnavailableReason.NotConfigured);
    }
    const window = resolveUsageWindow(period, new Date());

    /*
     * There is no permissions pre-check: every query carries
     * OWN_ROWS_PREDICATE, so it is safe whether or not the caller's view is
     * row-restricted, and a caller who cannot read the table is refused by
     * the queries themselves. Schema discovery starts first; its rejection
     * is captured here so it is never unhandled.
     */
    const discovery = this.analytics
      .getUsageLogSchema(accessToken)
      .then(discover, (error: unknown): SchemaDiscovery => ({
        exposed: false,
        budgetColumns: false,
        error,
      }));

    /*
     * Step 1, budget scope only: the budget columns must be visible, or the
     * queries would fail on an unknown field instead of saying the narrowing
     * is unsupported.
     */
    if (budget) {
      const { budgetColumns, error } = await discovery;
      if (error !== undefined) {
        if (isRefusal(error)) return this.forbidden(period, error);
        return this.unavailableAfter(period, error);
      }
      if (!budgetColumns) {
        this.logger.warn(
          `Usage history (${period}) for a budget unsupported: the caller's DIAL Analytics ` +
            'schema of dial_usage_log has no budget columns (ai-dial-analytics V18, ai-dial-core#2308)',
        );
        return unavailable(UsageHistoryUnavailableReason.BudgetUnsupported);
      }
    }

    /*
     * Step 2: daily totals and the model ranking start at once; the optional
     * client split follows discovery on its own. Without a budget a slow
     * schema endpoint therefore never delays the required queries; in budget
     * scope Step 1 has already awaited it.
     */
    const clientSplit = this.queryClientSplit(
      accessToken,
      period,
      window,
      discovery,
      budget,
    );
    /* Set once ADAS has run a query with the own-rows caller value. */
    let hasAcceptedOwnRows = false;
    try {
      const [dailyTotals, ranking] = await Promise.all([
        this.analytics.executeQuery(
          accessToken,
          buildDailyTotalsQuery(window, budget),
        ),
        this.analytics.executeQuery(
          accessToken,
          buildModelRankingQuery(window, budget),
        ),
      ]);
      hasAcceptedOwnRows = true;
      const ranked = rankDeployments(ranking);

      /* Step 3: the per-day split of the ranked top deployments. */
      const topNames = selectTopDeployments(ranked).map(
        (entry) => entry.deployment,
      );
      const dailyTopModels =
        topNames.length > 0
          ? await this.analytics.executeQuery(
              accessToken,
              buildDailyTopModelsQuery(window, topNames, budget),
            )
          : undefined;

      return buildAvailableHistory({
        period,
        window,
        budget,
        dailyTotals,
        ranked,
        dailyTopModels,
        clientSplit: await clientSplit,
      });
    } catch (error) {
      if (isRefusal(error) || error instanceof NotFoundException) {
        return this.forbidden(period, error);
      }
      /*
       * The query documents are fixed, so a 400 to the first queries means
       * ADAS cannot run the own-rows filter (see OWN_ROWS_HINT). It is never
       * retried without it: there is no unconfined query to fall back to.
       * After ADAS has accepted the filter, a 400 is a BFF defect.
       */
      if (error instanceof BadRequestException && !hasAcceptedOwnRows) {
        this.logger.warn(
          `Usage history (${period}) refused: DIAL Analytics answered ${describeError(error)} ` +
            `to a usage query; ${OWN_ROWS_HINT}`,
        );
        return unavailable(UsageHistoryUnavailableReason.Forbidden);
      }
      return this.unavailableAfter(period, error);
    }
  }

  /*
   * The optional client split: never rejects, resolving to undefined (and
   * logging why) when discovery failed, the field is absent or its query failed.
   */
  private async queryClientSplit(
    accessToken: string,
    period: UsageHistoryPeriod,
    window: UsageWindow,
    discovery: Promise<SchemaDiscovery>,
    budget: UsageBudget | undefined,
  ): Promise<unknown> {
    const { exposed, error } = await discovery;
    if (error !== undefined) {
      this.logger.warn(
        `Usage history (${period}): client breakdown omitted, schema discovery failed with ${describeError(error)}`,
      );
      return undefined;
    }
    if (!exposed) return undefined;
    try {
      return await this.analytics.executeQuery(
        accessToken,
        buildClientSplitQuery(window, budget),
      );
    } catch (queryError) {
      this.logger.warn(
        `Usage history (${period}): client breakdown omitted, its query failed with ${describeError(queryError)}`,
      );
      return undefined;
    }
  }

  private forbidden(
    period: UsageHistoryPeriod,
    error: unknown,
  ): UserUsageHistoryResponseDto {
    this.logger.warn(
      `Usage history (${period}) refused: DIAL Analytics answered ${describeError(error)} ` +
        `to the caller's session token, a configuration problem; ${FORBIDDEN_HINT}`,
    );
    return unavailable(UsageHistoryUnavailableReason.Forbidden);
  }

  private unavailableAfter(
    period: UsageHistoryPeriod,
    error: unknown,
  ): UserUsageHistoryResponseDto {
    this.logger.error(
      `Usage history (${period}) unavailable: DIAL Analytics failed with ${describeError(error)}`,
    );
    return unavailable(UsageHistoryUnavailableReason.Unavailable);
  }
}
