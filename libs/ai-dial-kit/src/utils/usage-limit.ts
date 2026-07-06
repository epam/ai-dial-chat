import {
  type ModelUsageRowData,
  UsageLimitState,
  UsageRowScope,
} from '../types/usage-limit';

/** Default fraction of remaining budget at/below which the state becomes `Warning` (85% used). */
export const DEFAULT_USAGE_WARNING_THRESHOLD = 0.15;

/**
 * Derives the `UsageLimitState` for one scope from raw usage numbers.
 * `limit === null` means no budget is configured, which always resolves to `Unlimited`.
 */
export const getUsageLimitState = (
  used: number,
  limit: number | null,
  warningThreshold: number = DEFAULT_USAGE_WARNING_THRESHOLD,
): UsageLimitState => {
  if (limit == null) {
    return UsageLimitState.Unlimited;
  }
  if (used >= limit) {
    return UsageLimitState.Blocked;
  }
  const remainingFraction = (limit - used) / limit;
  if (remainingFraction <= warningThreshold) {
    return UsageLimitState.Warning;
  }
  return UsageLimitState.Normal;
};

/** Formats an amount as a currency string using the runtime's `Intl` support. */
export const formatUsageAmount = (
  amount: number,
  currency: string,
  maximumFractionDigits?: number,
): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(amount);

/** Percentage (0–100) of the budget consumed so far, for driving a meter. `Unlimited` scopes render a full meter. */
export const getUsagePercentage = (
  used: number,
  limit: number | null,
): number => {
  if (limit == null || limit <= 0) {
    return 100;
  }
  return Math.min(100, Math.max(0, (used / limit) * 100));
};

const STATE_PRIORITY: Record<UsageLimitState, number> = {
  [UsageLimitState.Unlimited]: 0,
  [UsageLimitState.Normal]: 1,
  [UsageLimitState.Warning]: 2,
  [UsageLimitState.Blocked]: 3,
};

/**
 * Picks the overall status for a model row from its daily and monthly scopes: whichever
 * scope is in the worse state wins (`Blocked` > `Warning` > `Normal` > `Unlimited`). A row
 * with no cap on either scope resolves to `Unlimited` with no scope. Ties prefer `daily`,
 * since it is the more time-sensitive scope.
 */
export const getModelRowState = (
  row: Pick<ModelUsageRowData, 'today' | 'thisMonth'>,
  warningThreshold: number = DEFAULT_USAGE_WARNING_THRESHOLD,
): { state: UsageLimitState; scope: UsageRowScope | null } => {
  const dailyState = getUsageLimitState(
    row.today.used,
    row.today.limit,
    warningThreshold,
  );
  const monthlyState = getUsageLimitState(
    row.thisMonth.used,
    row.thisMonth.limit,
    warningThreshold,
  );

  if (STATE_PRIORITY[dailyState] >= STATE_PRIORITY[monthlyState]) {
    return {
      state: dailyState,
      scope:
        dailyState === UsageLimitState.Unlimited ? null : UsageRowScope.Daily,
    };
  }
  return { state: monthlyState, scope: UsageRowScope.Monthly };
};
