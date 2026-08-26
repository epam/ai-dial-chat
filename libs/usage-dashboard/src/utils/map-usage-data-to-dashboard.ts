import type {
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type { UsageLimitCardData } from '../models/usage-limit-card-props';
import { UsageLimitStatus } from '../models/usage-limit-card-props';

/** A translate function compatible with i18next's `TFunction`. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

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

const mapStatsToCardData = (
  stats: LimitStatsDto,
  title: string,
  periodDescription: string,
  t: Translate,
): UsageLimitCardData => {
  const used = Math.max(0, stats.used);
  const usedLabel = formatCost(used);

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
  };
};

/**
 * i18n key strings that the consuming app's translation bundle must define for
 * `mapUsageDataToDashboard` to produce correctly translated strings. The
 * values are the default key paths used by AI DIAL Chat.
 */
export const USAGE_DATA_I18N_KEYS = {
  /** Title for the "today" card (e.g. `'Daily'`). */
  todayTitle: 'usage.todayTitle',
  /** Period description for the "today" card (e.g. `'Today'`). */
  todayPeriodDescription: 'usage.todayPeriodDescription',
  /** Title for the "this week" card. */
  thisWeekTitle: 'usage.thisWeekTitle',
  /** Period description for the "this week" card. */
  thisWeekPeriodDescription: 'usage.thisWeekPeriodDescription',
  /** Title for the "this month" card. */
  thisMonthTitle: 'usage.thisMonthTitle',
  /** Period description for the "this month" card. */
  thisMonthPeriodDescription: 'usage.thisMonthPeriodDescription',
  /** Aria label when there is no limit. Receives `{ used: string }`. */
  unlimitedProgressAriaLabel: 'usage.unlimitedProgressAriaLabel',
  /** Aria label for a progress bar with a finite limit. Receives `{ used: string, total: string, percent: number }`. */
  progressAriaLabel: 'usage.progressAriaLabel',
} as const;

/**
 * Maps a `UserLimitStatsResponseDto` into `UsageLimitCardGroup`'s `cards` prop,
 * in Today / This week / This month order. A period is omitted entirely when
 * the response carries no usable stat for it.
 */
export const mapUsageDataToDashboard = (
  usage: UserLimitStatsResponseDto | undefined,
  t: Translate,
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
      ? [mapStatsToCardData(stats, t(titleKey), t(periodDescriptionKey), t)]
      : [],
  );
};
