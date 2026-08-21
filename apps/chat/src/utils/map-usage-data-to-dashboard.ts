import type {
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { formatPrice } from '@epam/ai-dial-chat-shared';
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

// TODO: Investigate whether usage limits support configurable currencies or USD only.

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
  const usedLabel = formatPrice(used);

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
  const totalLabel = formatPrice(total);

  return {
    title,
    periodDescription,
    used,
    total,
    usedLabel,
    totalLabel,
    remainingLabel: formatPrice(remaining),
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
 * Maps `useUsageData`'s `usage` response into `UsageLimitCardGroup`'s `cards` prop, in Today/This
 * week/This month order. A period is omitted entirely when the response carries no usable stat
 * for it. The top-level `dayCostStats`/`weekCostStats`/`monthCostStats` fields are the caller's
 * real global cost budget — the same semantics `GET /api/v1/user/limits` would report — so no
 * second source or fallback is needed here.
 */
export const mapUsageDataToDashboard = (
  usage: UserLimitStatsResponseDto | undefined,
  t: TFunction,
): UsageLimitCardData[] => {
  const periods: {
    stats: LimitStatsDto | undefined;
    titleKey: UsageI18nKeys;
    periodDescriptionKey: UsageI18nKeys;
  }[] = [
    {
      stats: usage?.dayCostStats,
      titleKey: UsageI18nKeys.TodayTitle,
      periodDescriptionKey: UsageI18nKeys.TodayPeriodDescription,
    },
    {
      stats: usage?.weekCostStats,
      titleKey: UsageI18nKeys.ThisWeekTitle,
      periodDescriptionKey: UsageI18nKeys.ThisWeekPeriodDescription,
    },
    {
      stats: usage?.monthCostStats,
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
