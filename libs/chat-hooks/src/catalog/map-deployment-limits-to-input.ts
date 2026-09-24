import {
  CatalogLimitStatus,
  type CatalogItemLimits,
  type UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type { FormatResetTime } from '../usage/map-usage-data-to-dashboard';

/** Labels and formatter callbacks for the conversation-input limits mapping utility. */
export interface ConversationInputLimitsLabels {
  /** Heading of the group every token stat row is listed under. */
  tokenGroup: string;
  /** Label for the current-UTC-day stat row. */
  tokensPerDay: string;
  /** Label for the current-UTC-week stat row. */
  tokensPerWeek: string;
  /** Label for the current-UTC-month stat row. */
  tokensPerMonth: string;
  /** Note shown instead of a total on a row whose limit follows the cost limit. */
  followsCostLimit: string;
  /** Formats the "$X spent" caption under a row's label. */
  formatSpentCaption: (amount: string) => string;
  /** Formats the combined used/total display value for a capped row. */
  formatValueLabel: (used: string, total: string) => string;
  /** Formats the ARIA label for a capped progress row. */
  formatProgressAriaLabel: (params: {
    label: string;
    used: string;
    total: string;
  }) => string;
  /** Formats the ARIA label for an unlimited row, which has no total to announce. */
  formatFollowsCostLimitAriaLabel: (params: {
    label: string;
    used: string;
  }) => string;
}

type StatLabelField = 'tokensPerDay' | 'tokensPerWeek' | 'tokensPerMonth';

interface PeriodMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelField: StatLabelField;
  /** Sibling cost stat for the same period, shown as a "$X spent" caption under the label. */
  costKey: keyof DeploymentLimitsResponseDto;
}

/*
 * Day, week, and month only. `minuteTokenStats` is a rolling-minute counter
 * whose value changes between two openings of the popover for reasons the
 * viewer cannot attribute to their own actions, so a static row for it would
 * be noise rather than headroom they can act on.
 */
const PERIOD_MAPPINGS: PeriodMapping[] = [
  { key: 'dayTokenStats', labelField: 'tokensPerDay', costKey: 'dayCostStats' },
  {
    key: 'weekTokenStats',
    labelField: 'tokensPerWeek',
    costKey: 'weekCostStats',
  },
  {
    key: 'monthTokenStats',
    labelField: 'tokensPerMonth',
    costKey: 'monthCostStats',
  },
];

/** Upstream sentinel: a `total` at or above this means the period follows the cost limit instead. */
const UNLIMITED_TOTAL_THRESHOLD = Number.MAX_SAFE_INTEGER;

/** Usage ratio at/above which a capped row counts as running low, short of the limit itself. */
const RUNNING_LOW_RATIO = 0.75;

/** Compact-notation magnitudes, largest first, so the first match wins. */
const COMPACT_MAGNITUDES = [1_000_000, 1_000] as const;

/** Formats token counts with compact K/M suffixes for display, e.g. `1.6M`, `900K`, `410`. */
const numberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formats token counts in full for `aria-label` text, e.g. `1,600,000` instead of `1.6M`. */
const fullNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/*
 * TypeScript's `es2022` lib predates `Intl.NumberFormatOptions.roundingMode`,
 * so `numberFormatter` can't be told to truncate directly. Truncating the raw
 * value toward zero to 1 decimal at whichever compact magnitude applies makes
 * `numberFormatter`'s own rounding a no-op — it never rounds a "used" figure
 * up past what was actually consumed.
 */
const truncateForCompactDisplay = (value: number): number => {
  const magnitude = COMPACT_MAGNITUDES.find(
    (threshold) => Math.abs(value) >= threshold,
  );
  if (magnitude == null) {
    return value;
  }

  return (Math.trunc((value / magnitude) * 10) / 10) * magnitude;
};

const isUsableLimitStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto =>
  stats != null &&
  Number.isFinite(stats.total) &&
  Number.isFinite(stats.used) &&
  stats.total > 0;

const isUnlimitedTotal = (total: number): boolean =>
  total >= UNLIMITED_TOTAL_THRESHOLD;

/*
 * Per-deployment cost stats are attributed spend, not a per-deployment cap, so
 * only `used` is read here — a `total` on the same object isn't a real limit
 * for this caption.
 */
const isUsableCostStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto =>
  stats != null && Number.isFinite(stats.total) && Number.isFinite(stats.used);

const buildSpentCaption = (
  stats: LimitStatsDto | undefined,
  labels: ConversationInputLimitsLabels,
): string | undefined => {
  if (!isUsableCostStats(stats)) {
    return undefined;
  }

  return labels.formatSpentCaption(formatCost(Math.max(0, stats.used)));
};

/*
 * Spread into a row so that an unformattable reset time leaves all three
 * fields absent rather than present-and-undefined.
 */
const buildResetFields = (
  stats: LimitStatsDto,
  formatResetTime: FormatResetTime | undefined,
): Pick<
  UsageLimitProgressRow,
  'resetLabel' | 'resetIsoValue' | 'resetAriaLabel'
> => {
  const reset = formatResetTime?.(stats.resetsAt);
  if (!reset) {
    return {};
  }

  return {
    resetLabel: reset.label,
    resetIsoValue: reset.isoValue,
    resetAriaLabel: reset.ariaLabel,
  };
};

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  captionLabel: string | undefined,
  labels: ConversationInputLimitsLabels,
  formatResetTime: FormatResetTime | undefined,
): UsageLimitProgressRow => {
  const used = Math.max(0, stats.used);
  const total = stats.total;
  const formattedUsed = numberFormatter.format(truncateForCompactDisplay(used));
  const formattedTotal = numberFormatter.format(total);
  const fullUsed = fullNumberFormatter.format(used);
  const fullTotal = fullNumberFormatter.format(total);
  const isUnlimited = isUnlimitedTotal(total);

  return {
    label,
    used,
    total,
    captionLabel,
    ...buildResetFields(stats, formatResetTime),
    ...(isUnlimited
      ? { isUnlimited: true, noteLabel: labels.followsCostLimit }
      : { usedLabel: formattedUsed, totalLabel: formattedTotal }),
    valueLabel: isUnlimited
      ? formattedUsed
      : labels.formatValueLabel(formattedUsed, formattedTotal),
    ariaLabel: isUnlimited
      ? labels.formatFollowsCostLimitAriaLabel({ label, used: fullUsed })
      : labels.formatProgressAriaLabel({
          label,
          used: fullUsed,
          total: fullTotal,
        }),
  };
};

/** Ratio of `used` to `total` for a capped stat; `0` for an unlimited or otherwise uncapped one. */
const getCappedRatio = (stats: LimitStatsDto): number =>
  isUnlimitedTotal(stats.total) ? 0 : Math.max(stats.used, 0) / stats.total;

/** Worst-case status across every capped stat, `LimitReached` outranking `RunningLow`. */
const getOverallStatus = (
  statsList: LimitStatsDto[],
): CatalogLimitStatus | undefined =>
  statsList.reduce<CatalogLimitStatus | undefined>((worst, stats) => {
    const ratio = getCappedRatio(stats);
    if (ratio >= 1) {
      return CatalogLimitStatus.LimitReached;
    }
    if (
      ratio >= RUNNING_LOW_RATIO &&
      worst !== CatalogLimitStatus.LimitReached
    ) {
      return CatalogLimitStatus.RunningLow;
    }
    return worst;
  }, undefined);

/** Maps the day, week, and month deployment token limits to display-ready rows, or `undefined` when none qualify. */
export const mapDeploymentLimitsToInput = (
  dto: DeploymentLimitsResponseDto | undefined,
  labels: ConversationInputLimitsLabels,
  formatResetTime?: FormatResetTime,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const usableStats: LimitStatsDto[] = [];
  const rows = PERIOD_MAPPINGS.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!isUsableLimitStats(stats)) {
      return [];
    }

    usableStats.push(stats);
    return [
      mapLimitStatsToRow(
        stats,
        labels[mapping.labelField],
        buildSpentCaption(dto[mapping.costKey], labels),
        labels,
        formatResetTime,
      ),
    ];
  });

  return rows.length > 0
    ? {
        groups: [{ label: labels.tokenGroup, rows }],
        status: getOverallStatus(usableStats),
      }
    : undefined;
};
