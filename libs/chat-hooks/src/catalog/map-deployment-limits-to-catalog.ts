import {
  CatalogLimitStatus,
  type CatalogItemLimits,
  type UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';
import type { FormatResetTime } from '../usage/map-usage-data-to-dashboard';
import { buildResetFields } from './map-deployment-limits-to-input';

/** Labels and formatter callbacks for the deployment-limits mapping utility. */
export interface DeploymentLimitsLabels {
  /** Heading of the group every token stat row is listed under. */
  tokenGroup: string;
  /** Label for the current-UTC-day token row, e.g. "Today". */
  tokensPerDay: string;
  /** Label for the current-UTC-week token row, e.g. "This week". */
  tokensPerWeek: string;
  /** Label for the current-UTC-month token row, e.g. "This month". */
  tokensPerMonth: string;
  /** Note shown instead of a total on a row whose limit follows the cost limit. */
  followsCostLimit: string;
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
  /** Formats each period's `resetsAt` into the row's reset line. Omit it to render rows without one. */
  formatResetTime?: FormatResetTime;
}

type StatLabelField = 'tokensPerDay' | 'tokensPerWeek' | 'tokensPerMonth';

interface DeploymentLimitMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelField: StatLabelField;
}

/*
 * Token stats for the current UTC calendar day, week, and month — the same
 * periods the Usage page reports, each resetting at its `resetsAt` instant.
 * The cost stats on a deployment-limits response are the caller's account-wide
 * budget and spend across every deployment, not this deployment's own spend,
 * so they are never shown here — per-deployment spend is only reported by
 * GET /v1/user/usage.
 */
const LIMIT_STAT_MAPPINGS: DeploymentLimitMapping[] = [
  { key: 'dayTokenStats', labelField: 'tokensPerDay' },
  { key: 'weekTokenStats', labelField: 'tokensPerWeek' },
  { key: 'monthTokenStats', labelField: 'tokensPerMonth' },
];

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
 * up past what was actually consumed (e.g. 1,999,000 displays "1.9M", not
 * the rounded "2M" the plain compact formatter would otherwise show).
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

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  labels: DeploymentLimitsLabels,
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
    ...buildResetFields(stats, labels.formatResetTime),
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

/** Maps a deployment limits DTO to display-ready catalog limits, or `undefined` when no qualifying stats exist. */
export const mapDeploymentLimitsDtoToCatalogLimits = (
  dto: DeploymentLimitsResponseDto | undefined,
  labels: DeploymentLimitsLabels,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const usableStats: LimitStatsDto[] = [];
  const rows = LIMIT_STAT_MAPPINGS.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!isUsableLimitStats(stats)) {
      return [];
    }

    usableStats.push(stats);
    return [mapLimitStatsToRow(stats, labels[mapping.labelField], labels)];
  });

  return rows.length > 0
    ? {
        groups: [{ label: labels.tokenGroup, rows }],
        status: getOverallStatus(usableStats),
      }
    : undefined;
};
