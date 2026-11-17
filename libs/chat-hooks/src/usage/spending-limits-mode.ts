import type {
  BudgetStatsDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';

/** DIAL Core's `spendingLimits.mode`, as the host's operator declares it. */
export enum SpendingLimitsMode {
  /** Budgets are not presented; the role cost limit is the account limit. */
  Off = 'off',
  /** Budgets are presented as not yet enforced; the role cost limit still decides. */
  Shadow = 'shadow',
  /** Budgets limit model calls; the role cost limit applies to application calls only. */
  Enforce = 'enforce',
}

/** The parts of a user usage or limits response that decide the effective mode. */
export interface SpendingLimitsEvidence {
  /** The cost object whose budgets the caller's model calls are charged to. */
  costObject?: string;
  /** Every budget that applies to the caller. */
  budgets?: BudgetStatsDto[];
}

/** The top-level role cost stats `omitAccountCostStats` removes. */
export interface AccountCostStats {
  /** The role cost limit and spend for the current minute. */
  minuteCostStats?: LimitStatsDto;
  /** The role cost limit and spend for the current day. */
  dayCostStats?: LimitStatsDto;
  /** The role cost limit and spend for the current week. */
  weekCostStats?: LimitStatsDto;
  /** The role cost limit and spend for the current month. */
  monthCostStats?: LimitStatsDto;
}

const ACCOUNT_COST_STAT_KEYS: readonly (keyof AccountCostStats)[] = [
  'minuteCostStats',
  'dayCostStats',
  'weekCostStats',
  'monthCostStats',
];

const SPENDING_LIMITS_MODES: ReadonlySet<string> = new Set(
  Object.values(SpendingLimitsMode),
);

/** Returns `value` as a `SpendingLimitsMode`, or `SpendingLimitsMode.Off` when it is not one. */
export const parseSpendingLimitsMode = (value: unknown): SpendingLimitsMode =>
  typeof value === 'string' && SPENDING_LIMITS_MODES.has(value)
    ? (value as SpendingLimitsMode)
    : SpendingLimitsMode.Off;

/** Returns `configured` when `usage` carries a `budgets` array and a non-empty `costObject`, otherwise `SpendingLimitsMode.Off`. */
export const resolveSpendingLimitsMode = (
  configured: SpendingLimitsMode,
  usage: SpendingLimitsEvidence | undefined,
): SpendingLimitsMode => {
  /*
   * DIAL Core omits `costObject` exactly when its spending limits are off (or
   * it predates epam/ai-dial-core#2284), so a chat configured for budgets
   * falls back to the role cost limit that Core still enforces.
   */
  if (
    !Array.isArray(usage?.budgets) ||
    typeof usage.costObject !== 'string' ||
    usage.costObject.trim() === ''
  ) {
    return SpendingLimitsMode.Off;
  }
  return configured;
};

/** Returns a copy of `usage` without the four top-level role cost stats; every other field is kept. */
export const omitAccountCostStats = <T extends AccountCostStats>(
  usage: T,
): Omit<T, keyof AccountCostStats> => {
  const rest: Partial<T> = { ...usage };
  for (const key of ACCOUNT_COST_STAT_KEYS) {
    delete rest[key];
  }
  return rest as Omit<T, keyof AccountCostStats>;
};

/** Returns `usage` without its role cost stats when the effective mode is `Enforce`, and `usage` unchanged otherwise. */
export const withholdAccountCostInEnforce = <
  T extends AccountCostStats & SpendingLimitsEvidence,
>(
  usage: T | undefined,
  configured: SpendingLimitsMode,
): T | undefined => {
  if (
    usage == null ||
    resolveSpendingLimitsMode(configured, usage) !== SpendingLimitsMode.Enforce
  ) {
    return usage;
  }
  // Every removed field is optional on `T`, so the copy still satisfies it.
  return omitAccountCostStats(usage) as T;
};
