import type {
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  UsageLimitCardData,
  UsageLimitStatus,
} from '@epam/ai-dial-usage-dashboard';
import type { TFunction } from 'i18next';
import { UsageI18nKeys } from '../constants/translation-keys';

/** Upstream sentinel (`Long.MAX_VALUE` exceeds this): a `total` at or above it means "unlimited". */
const UNLIMITED_TOTAL_THRESHOLD = 2 ** 53;

/** Percentage at/above which a card is `RunningLow` — below this it's `Default` ("within limits"). */
const RUNNING_LOW_THRESHOLD_PERCENT = 75;

const costFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

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

const mapStatsToCardData = (
  stats: LimitStatsDto,
  title: string,
  periodDescription: string,
  t: TFunction,
): UsageLimitCardData => {
  const used = Math.max(0, stats.used);
  const usedLabel = costFormatter.format(used);

  if (stats.total >= UNLIMITED_TOTAL_THRESHOLD) {
    return {
      title,
      periodDescription,
      used,
      total: stats.total,
      usedLabel,
      isUnlimited: true,
      status: UsageLimitStatus.Default,
      progressAriaLabel: t(UsageI18nKeys.UnlimitedProgressAriaLabel, {
        used: usedLabel,
      }),
    };
  }

  const total = Math.max(stats.total, 0);
  const remaining = Math.max(total - used, 0);
  const uncappedUsedPercent = total > 0 ? (used / total) * 100 : 100;
  const totalLabel = costFormatter.format(total);

  return {
    title,
    periodDescription,
    used,
    total,
    usedLabel,
    totalLabel,
    remainingLabel: costFormatter.format(remaining),
    usedPercent: uncappedUsedPercent,
    status: getStatus(uncappedUsedPercent),
    progressAriaLabel: t(UsageI18nKeys.ProgressAriaLabel, {
      used: usedLabel,
      total: totalLabel,
      percent: Math.round(uncappedUsedPercent),
    }),
  };
};

/**
 * Maps `useUsageData`'s `limits`/`usage` responses into `UsageLimitCardGroup`'s `cards` prop, in
 * Today/This week/This month order. A period is omitted entirely when neither response carries a
 * usable stat for it.
 *
 * The top-level `dayCostStats`/`weekCostStats`/`monthCostStats` fields represent the same global
 * cost budget in both responses, so each field is read from `limits` first and falls back to
 * `usage` only for that field — this fallback is specific to these aggregate fields and must not
 * be generalized to per-deployment data.
 */
export const mapUsageDataToDashboard = (
  limits: UserLimitStatsResponseDto | undefined,
  usage: UserLimitStatsResponseDto | undefined,
  t: TFunction,
): UsageLimitCardData[] => {
  const periods: {
    stats: LimitStatsDto | undefined;
    titleKey: UsageI18nKeys;
    periodDescriptionKey: UsageI18nKeys;
  }[] = [
    {
      stats: limits?.dayCostStats ?? usage?.dayCostStats,
      titleKey: UsageI18nKeys.TodayTitle,
      periodDescriptionKey: UsageI18nKeys.TodayPeriodDescription,
    },
    {
      stats: limits?.weekCostStats ?? usage?.weekCostStats,
      titleKey: UsageI18nKeys.ThisWeekTitle,
      periodDescriptionKey: UsageI18nKeys.ThisWeekPeriodDescription,
    },
    {
      stats: limits?.monthCostStats ?? usage?.monthCostStats,
      titleKey: UsageI18nKeys.ThisMonthTitle,
      periodDescriptionKey: UsageI18nKeys.ThisMonthPeriodDescription,
    },
  ];

  return periods.flatMap(({ stats, titleKey, periodDescriptionKey }) =>
    isUsableStats(stats)
      ? [mapStatsToCardData(stats, t(titleKey), t(periodDescriptionKey), t)]
      : [],
  );
};
