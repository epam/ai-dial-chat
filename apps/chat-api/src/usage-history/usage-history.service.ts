import {
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
  'providers, the `*` grant on dial_usage_log and its `user_hash = caller.user_hash` row policy';

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

/* The caller's ADAS view of the usage log is confined by a row policy. */
const isRowRestricted = (table: unknown): boolean => {
  const permissions =
    table != null && typeof table === 'object'
      ? (
          table as {
            permissions?: { read?: unknown; rows_restricted?: unknown };
          }
        ).permissions
      : undefined;
  return permissions?.read === true && permissions.rows_restricted === true;
};

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
 * the caller's own token. Every failure becomes an `available: false` body
 * with a reason, never an HTTP error, and partial data is never returned. See
 * openspec/changes/add-user-usage-history-api/design.md (D4, D6).
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
     * Step 1: the row-restriction guard. Schema discovery starts beside it
     * but is only read once the guard has passed; its rejection is captured
     * here so it is never unhandled when the guard refuses. In budget scope
     * the schema read is required (Step 1b gates every query on it, so its
     * latency and failure decide the response); otherwise it only feeds the
     * optional client split and its failure is only logged.
     */
    const discovery = this.analytics
      .getUsageLogSchema(accessToken)
      .then(discover, (error: unknown): SchemaDiscovery => ({
        exposed: false,
        budgetColumns: false,
        error,
      }));
    try {
      const table = await this.analytics.getUsageLogTable(accessToken);
      if (!isRowRestricted(table)) {
        this.logger.warn(
          `Usage history (${period}) refused: the caller's DIAL Analytics view of dial_usage_log ` +
            `is not row-restricted, so it would show other users' usage; ${FORBIDDEN_HINT}`,
        );
        return unavailable(UsageHistoryUnavailableReason.Forbidden);
      }
    } catch (error) {
      if (isRefusal(error) || error instanceof NotFoundException) {
        return this.forbidden(period, error);
      }
      return this.unavailableAfter(period, error);
    }

    /*
     * Step 1b, budget scope only: the budget columns must be visible, or the
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
     * scope Step 1b has already awaited it.
     */
    const clientSplit = this.queryClientSplit(
      accessToken,
      period,
      window,
      discovery,
      budget,
    );
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
      if (isRefusal(error)) {
        return this.forbidden(period, error);
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
