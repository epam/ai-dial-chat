import {
  CatalogLimitStatus,
  type CatalogItemLimits,
  type UsageLimitGroup,
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
  /** Heading of the group listing the selected deployment's token limits. */
  tokenGroup: string;
  /** Heading of the group listing the caller's cost budget, which spans every deployment. */
  costGroup: string;
  /** Label for the current-UTC-day row, used by both groups. */
  periodDay: string;
  /** Label for the current-UTC-week row, used by both groups. */
  periodWeek: string;
  /** Label for the current-UTC-month row, used by both groups. */
  periodMonth: string;
  /** Formats the combined used/total display value for a capped row. */
  formatValueLabel: (used: string, total: string) => string;
  /** Formats the ARIA label for a capped progress row. */
  formatProgressAriaLabel: (params: {
    label: string;
    used: string;
    total: string;
  }) => string;
}

type PeriodLabelField = 'periodDay' | 'periodWeek' | 'periodMonth';

interface PeriodMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelField: PeriodLabelField;
}

/*
 * Day, week, and month only. `minuteTokenStats` is a rolling-minute counter
 * whose value changes between two openings of the popover for reasons the
 * viewer cannot attribute to their own actions, so a static row for it would
 * be noise rather than headroom they can act on.
 */
const TOKEN_MAPPINGS: PeriodMapping[] = [
  { key: 'dayTokenStats', labelField: 'periodDay' },
  { key: 'weekTokenStats', labelField: 'periodWeek' },
  { key: 'monthTokenStats', labelField: 'periodMonth' },
];

/*
 * The cost stats on a deployment-limits response are the caller's own budget,
 * spanning every deployment rather than the one that was queried — the same
 * figures come back whichever deployment is asked. They are listed as their own
 * group, and never as a caption on a token row, so the spend is not read as
 * this model's alone.
 */
const COST_MAPPINGS: PeriodMapping[] = [
  { key: 'dayCostStats', labelField: 'periodDay' },
  { key: 'weekCostStats', labelField: 'periodWeek' },
  { key: 'monthCostStats', labelField: 'periodMonth' },
];

/** Upstream sentinel: a `total` at or above this means the period carries no cap of its own. */
const UNLIMITED_TOTAL_THRESHOLD = Number.MAX_SAFE_INTEGER;

/**
 * Usage ratio at/above which a capped row counts as running low, and — since
 * only rows at or past it are listed at all — the ratio at which a row becomes
 * visible. It matches `CatalogLimitStatus`'s own running-low threshold, so the
 * bar's warning fill and the row's presence are decided by one number.
 */
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

/** How one group's figures are rendered. */
interface GroupFormat {
  /** Compact display form, e.g. `1.6M` or `$12.35`. */
  format: (value: number) => string;
  /** Full form for `aria-label` text, e.g. `1,600,000` or `$12.35`. */
  formatFull: (value: number) => string;
}

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  labels: ConversationInputLimitsLabels,
  groupFormat: GroupFormat,
  formatResetTime: FormatResetTime | undefined,
): UsageLimitProgressRow => {
  const used = Math.max(0, stats.used);
  const total = stats.total;
  const formattedUsed = groupFormat.format(used);
  const formattedTotal = groupFormat.format(total);

  return {
    label,
    used,
    total,
    ...buildResetFields(stats, formatResetTime),
    usedLabel: formattedUsed,
    totalLabel: formattedTotal,
    valueLabel: labels.formatValueLabel(formattedUsed, formattedTotal),
    ariaLabel: labels.formatProgressAriaLabel({
      label,
      used: groupFormat.formatFull(used),
      total: groupFormat.formatFull(total),
    }),
  };
};

/** Ratio of `used` to `total` for a capped stat; `0` for an uncapped or otherwise unbounded one. */
const getCappedRatio = (stats: LimitStatsDto): number =>
  isUnlimitedTotal(stats.total) ? 0 : Math.max(stats.used, 0) / stats.total;

/*
 * The popover is a warning, not a dashboard: a row only earns its place once it
 * is close enough to its cap to be worth acting on. A deployment sitting at 2%
 * of its token allowance alongside an account budget at 90% would otherwise
 * bury the one figure that matters. Everything else lives on the Usage page.
 *
 * A row with no cap of its own has no ratio, so it never qualifies — which is
 * why no "unlimited" row is rendered and no note for one is needed.
 */
const isWorthShowing = (stats: LimitStatsDto): boolean =>
  getCappedRatio(stats) >= RUNNING_LOW_RATIO;

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

/** Collects the qualifying rows of one group, pushing each contributing stat onto `usableStats`. */
const buildGroup = (
  dto: DeploymentLimitsResponseDto,
  mappings: PeriodMapping[],
  groupLabel: string,
  labels: ConversationInputLimitsLabels,
  groupFormat: GroupFormat,
  formatResetTime: FormatResetTime | undefined,
  usableStats: LimitStatsDto[],
): UsageLimitGroup | undefined => {
  const rows = mappings.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!isUsableLimitStats(stats) || !isWorthShowing(stats)) {
      return [];
    }

    usableStats.push(stats);
    return [
      mapLimitStatsToRow(
        stats,
        labels[mapping.labelField],
        labels,
        groupFormat,
        formatResetTime,
      ),
    ];
  });

  return rows.length > 0 ? { label: groupLabel, rows } : undefined;
};

/** Maps a deployment's day, week, and month token limits and the caller's cost budget to display-ready rows, or `undefined` when none qualify. */
export const mapDeploymentLimitsToInput = (
  dto: DeploymentLimitsResponseDto | undefined,
  labels: ConversationInputLimitsLabels,
  formatResetTime?: FormatResetTime,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const usableStats: LimitStatsDto[] = [];

  const tokenGroup = buildGroup(
    dto,
    TOKEN_MAPPINGS,
    labels.tokenGroup,
    labels,
    {
      format: (value) =>
        numberFormatter.format(truncateForCompactDisplay(value)),
      formatFull: (value) => fullNumberFormatter.format(value),
    },
    formatResetTime,
    usableStats,
  );

  const costGroup = buildGroup(
    dto,
    COST_MAPPINGS,
    labels.costGroup,
    labels,
    {
      format: formatCost,
      formatFull: formatCost,
    },
    formatResetTime,
    usableStats,
  );

  const groups = [tokenGroup, costGroup].filter(
    (group): group is UsageLimitGroup => group != null,
  );

  return groups.length > 0
    ? { groups, status: getOverallStatus(usableStats) }
    : undefined;
};
