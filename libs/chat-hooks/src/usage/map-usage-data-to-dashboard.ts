import type {
  BudgetStatsDto,
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type {
  SpendingBudgetData,
  UsageLimitCardData,
} from '@epam/ai-dial-usage-dashboard';
import { UsageLimitStatus } from '@epam/ai-dial-usage-dashboard';
import type { ResetTimeDisplay } from './usage-reset-time';

/** A translate function compatible with i18next's `TFunction`. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Formats a raw `resetsAt` into display strings, or returns `undefined` when it cannot be formatted. */
export type FormatResetTime = (
  resetsAt: string | undefined,
) => ResetTimeDisplay | undefined;

/**
 * i18n key strings that the consuming app's translation bundle must define for
 * `mapUsageDataToDashboard` to produce correctly translated strings. The
 * values are the default key paths used by AI DIAL Chat.
 */
export const USAGE_DATA_I18N_KEYS = {
  /** Title for the current-UTC-day card (e.g. `'Today'`). */
  todayTitle: 'usage.todayTitle',
  /** Accessible period description for the current-UTC-day card. */
  todayPeriodDescription: 'usage.todayPeriodDescription',
  /** Title for the current-UTC-week card (e.g. `'This week'`). */
  thisWeekTitle: 'usage.thisWeekTitle',
  /** Accessible period description for the current-UTC-week card. */
  thisWeekPeriodDescription: 'usage.thisWeekPeriodDescription',
  /** Title for the current-UTC-month card (e.g. `'This month'`). */
  thisMonthTitle: 'usage.thisMonthTitle',
  /** Accessible period description for the current-UTC-month card. */
  thisMonthPeriodDescription: 'usage.thisMonthPeriodDescription',
  /** Aria label when there is no limit. Receives `{ used: string }`. */
  unlimitedProgressAriaLabel: 'usage.unlimitedProgressAriaLabel',
  /** Aria label for a progress bar with a finite limit. Receives `{ used: string, total: string, percent: number }`. */
  progressAriaLabel: 'usage.progressAriaLabel',
} as const;

/** Upstream sentinel (`Long.MAX_VALUE` exceeds this): a `total` at or above it means "unlimited". */
const UNLIMITED_TOTAL_THRESHOLD = 2 ** 53;

/** Percentage at/above which a card is `RunningLow` — below this it's `Default` ("within limits"). */
const RUNNING_LOW_THRESHOLD_PERCENT = 75;

const isUsableStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto =>
  stats != null && Number.isFinite(stats.total) && Number.isFinite(stats.used);

const getStatus = (usedPercent: number): UsageLimitStatus => {
  if (usedPercent >= 100) {
    return UsageLimitStatus.LimitReached;
  }
  if (usedPercent >= RUNNING_LOW_THRESHOLD_PERCENT) {
    return UsageLimitStatus.RunningLow;
  }
  return UsageLimitStatus.Default;
};

/*
 * Spread into a card so that an unformattable reset time leaves all three
 * fields absent rather than present-and-undefined.
 */
const buildResetFields = (
  reset: ResetTimeDisplay | undefined,
): Pick<
  UsageLimitCardData,
  'resetLabel' | 'resetIsoValue' | 'resetAriaLabel'
> => {
  if (!reset) {
    return {};
  }
  return {
    resetLabel: reset.label,
    resetIsoValue: reset.isoValue,
    resetAriaLabel: reset.ariaLabel,
  };
};

const mapStatsToCardData = (
  stats: LimitStatsDto,
  title: string,
  periodDescription: string,
  t: Translate,
  reset: ResetTimeDisplay | undefined,
): UsageLimitCardData => {
  const used = Math.max(0, stats.used);
  const usedLabel = formatCost(used);
  const resetFields = buildResetFields(reset);

  if (stats.total >= UNLIMITED_TOTAL_THRESHOLD) {
    return {
      title,
      periodDescription,
      used,
      total: stats.total,
      usedLabel,
      isUnlimited: true,
      status: UsageLimitStatus.Default,
      progressAriaLabel: t(USAGE_DATA_I18N_KEYS.unlimitedProgressAriaLabel, {
        used: usedLabel,
      }),
      ...resetFields,
    };
  }

  const total = Math.max(stats.total, 0);
  const remaining = Math.max(total - used, 0);
  const uncappedUsedPercent = total > 0 ? (used / total) * 100 : 100;
  const totalLabel = formatCost(total);

  return {
    title,
    periodDescription,
    used,
    total,
    usedLabel,
    totalLabel,
    remainingLabel: formatCost(remaining),
    usedPercent: uncappedUsedPercent,
    status: getStatus(uncappedUsedPercent),
    progressAriaLabel: t(USAGE_DATA_I18N_KEYS.progressAriaLabel, {
      used: usedLabel,
      total: totalLabel,
      percent: Math.round(uncappedUsedPercent),
    }),
    ...resetFields,
  };
};

/**
 * Maps a `UserLimitStatsResponseDto` into `UsageLimitCardGroup`'s `cards` prop,
 * in Today / This week / This month order. A period is omitted entirely when
 * the response carries no usable stat for it. Each card's reset trio comes from
 * `formatResetTime`, and is absent when that callback returns `undefined`.
 */
export const mapUsageDataToDashboard = (
  usage: UserLimitStatsResponseDto | undefined,
  t: Translate,
  formatResetTime: FormatResetTime,
): UsageLimitCardData[] => {
  const periods: {
    stats: LimitStatsDto | undefined;
    titleKey: string;
    periodDescriptionKey: string;
  }[] = [
    {
      stats: usage?.dayCostStats,
      titleKey: USAGE_DATA_I18N_KEYS.todayTitle,
      periodDescriptionKey: USAGE_DATA_I18N_KEYS.todayPeriodDescription,
    },
    {
      stats: usage?.weekCostStats,
      titleKey: USAGE_DATA_I18N_KEYS.thisWeekTitle,
      periodDescriptionKey: USAGE_DATA_I18N_KEYS.thisWeekPeriodDescription,
    },
    {
      stats: usage?.monthCostStats,
      titleKey: USAGE_DATA_I18N_KEYS.thisMonthTitle,
      periodDescriptionKey: USAGE_DATA_I18N_KEYS.thisMonthPeriodDescription,
    },
  ];

  return periods.flatMap(({ stats, titleKey, periodDescriptionKey }) =>
    isUsableStats(stats)
      ? [
          mapStatsToCardData(
            stats,
            t(titleKey),
            t(periodDescriptionKey),
            t,
            formatResetTime(stats.resetsAt),
          ),
        ]
      : [],
  );
};

/**
 * i18n key strings that the consuming app's translation bundle must define for
 * `mapBudgetsToDashboard`, beyond the Today and This month keys of
 * `USAGE_DATA_I18N_KEYS`. The values are the default key paths used by AI DIAL Chat.
 */
export const BUDGET_DATA_I18N_KEYS = {
  /** Coverage line of a budget that covers every model (e.g. `'All models'`). */
  allModels: 'usage.budgets.allModels',
  /** Coverage line of a budget that lists its models. Receives `{ models: string }`. */
  coveredModels: 'usage.budgets.coveredModels',
} as const;

/** Resolves a deployment id to its display name, or `undefined` when the host does not know it. */
export type ResolveModelName = (deploymentId: string) => string | undefined;

/* DIAL Core's `object` value for a budget that covers every deployment. */
const ALL_MODELS_OBJECT = '*';

const getBudgetTitle = (budget: BudgetStatsDto): string =>
  budget.displayName?.trim() ? budget.displayName : budget.policy;

const getBudgetCoverage = (
  object: BudgetStatsDto['object'],
  t: Translate,
  resolveModelName: ResolveModelName,
): string | undefined => {
  if (object === ALL_MODELS_OBJECT) {
    return t(BUDGET_DATA_I18N_KEYS.allModels);
  }
  if (!Array.isArray(object) || object.length === 0) {
    return undefined;
  }
  const models = object.map((id) => resolveModelName(id) ?? id).join(', ');
  return t(BUDGET_DATA_I18N_KEYS.coveredModels, { models });
};

/**
 * Maps the budgets charged for the caller's model calls — the `budgets`
 * entries whose `costObject` equals the response's `costObject` — into
 * `SpendingBudgetsSection`'s `budgets` prop, in response order, each with a
 * Today card and a This month card. Returns `[]` when the response carries no
 * `costObject` or no `budgets`.
 */
export const mapBudgetsToDashboard = (
  usage: Pick<UserLimitStatsResponseDto, 'budgets' | 'costObject'> | undefined,
  t: Translate,
  formatResetTime: FormatResetTime,
  resolveModelName: ResolveModelName,
): SpendingBudgetData[] => {
  const costObject = usage?.costObject;
  if (!costObject || !Array.isArray(usage?.budgets)) {
    return [];
  }

  /* A cost object can list the same policy twice; the occurrence keeps each key unique and stable. */
  const occurrences = new Map<string, number>();

  return usage.budgets
    .filter((budget) => budget.costObject === costObject)
    .map((budget) => {
      const occurrence = occurrences.get(budget.policy) ?? 0;
      occurrences.set(budget.policy, occurrence + 1);
      const coverageLabel = getBudgetCoverage(
        budget.object,
        t,
        resolveModelName,
      );
      const periods = [
        {
          stats: budget.day,
          titleKey: USAGE_DATA_I18N_KEYS.todayTitle,
          periodDescriptionKey: USAGE_DATA_I18N_KEYS.todayPeriodDescription,
        },
        {
          stats: budget.month,
          titleKey: USAGE_DATA_I18N_KEYS.thisMonthTitle,
          periodDescriptionKey: USAGE_DATA_I18N_KEYS.thisMonthPeriodDescription,
        },
      ];

      return {
        id: `${costObject}\u0000${budget.policy}\u0000${occurrence}`,
        title: getBudgetTitle(budget),
        ...(coverageLabel == null ? {} : { coverageLabel }),
        cards: periods.flatMap(({ stats, titleKey, periodDescriptionKey }) =>
          isUsableStats(stats)
            ? [
                mapStatsToCardData(
                  stats,
                  t(titleKey),
                  t(periodDescriptionKey),
                  t,
                  formatResetTime(stats.resetsAt),
                ),
              ]
            : [],
        ),
      };
    });
};
