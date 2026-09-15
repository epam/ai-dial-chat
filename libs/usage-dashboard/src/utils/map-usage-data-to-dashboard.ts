import type {
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type { UsageLimitCardData } from '../models/usage-limit-card-props';
import { UsageLimitStatus } from '../models/usage-limit-card-props';

/** A translate function compatible with i18next's `TFunction`. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One reset time, already parsed and formatted by the host. Declared
 * structurally here so the library never imports an application type; the host
 * passes a value that satisfies this shape.
 */
export interface ResetTimeDisplayLike {
  /** Exclusive end of the period as an epoch ms value, for the host's boundary scheduling. */
  resetsAtMs: number;
  /** Machine-readable instant for a `<time dateTime>` attribute. */
  isoValue: string;
  /** Visible reset line. */
  label: string;
  /** Accessible expansion of the reset line. */
  ariaLabel: string;
}

/** Formats a raw `resetsAt` into display strings, or returns `undefined` when it cannot be formatted. */
export type FormatResetTime = (
  resetsAt: string | undefined,
) => ResetTimeDisplayLike | undefined;

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
  reset: ResetTimeDisplayLike | undefined,
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
  reset: ResetTimeDisplayLike | undefined,
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
