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
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';

interface DeploymentLimitMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelKey: CatalogI18nKeys;
  /** Sibling cost stat for the same period, shown as a "$X spent" caption under the label. */
  costKey: keyof DeploymentLimitsResponseDto;
}

const LIMIT_STAT_MAPPINGS: DeploymentLimitMapping[] = [
  {
    key: 'dayTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerDay,
    costKey: 'dayCostStats',
  },
  {
    key: 'weekTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerWeek,
    costKey: 'weekCostStats',
  },
  {
    key: 'monthTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerMonth,
    costKey: 'monthCostStats',
  },
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

const shouldShowLimitStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto => {
  return isUsableLimitStats(stats);
};

/*
 * Per-deployment cost stats are attributed spend, not a per-deployment cap
 * (see map-user-usage-to-model-limits.ts), so only `used` is read here — a
 * `total` on the same object isn't a real limit for this caption.
 */
const isUsableCostStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto =>
  stats != null && Number.isFinite(stats.total) && Number.isFinite(stats.used);

const buildSpentCaption = (
  stats: LimitStatsDto | undefined,
  t: TFunction,
): string | undefined => {
  if (!isUsableCostStats(stats)) {
    return undefined;
  }

  const used = Math.max(0, stats.used);
  return t(CatalogI18nKeys.DetailsLimitsSpentLabel, {
    amount: formatCost(used),
  });
};

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  captionLabel: string | undefined,
  t: TFunction,
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
    ...(isUnlimited
      ? {
          isUnlimited: true,
          noteLabel: t(CatalogI18nKeys.DetailsLimitsFollowsCostLimitLabel),
        }
      : { usedLabel: formattedUsed, totalLabel: formattedTotal }),
    valueLabel: isUnlimited
      ? formattedUsed
      : t(CatalogI18nKeys.DetailsLimitsValue, {
          used: formattedUsed,
          total: formattedTotal,
        }),
    ariaLabel: isUnlimited
      ? t(CatalogI18nKeys.DetailsLimitsFollowsCostLimitAriaLabel, {
          label,
          used: fullUsed,
        })
      : t(CatalogI18nKeys.DetailsLimitsProgressAriaLabel, {
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

export const mapDeploymentLimitsDtoToCatalogLimits = (
  dto: DeploymentLimitsResponseDto | undefined,
  t: TFunction,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const usableStats: LimitStatsDto[] = [];
  const rows = LIMIT_STAT_MAPPINGS.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!shouldShowLimitStats(stats)) {
      return [];
    }

    usableStats.push(stats);
    const captionLabel = buildSpentCaption(dto[mapping.costKey], t);
    return [mapLimitStatsToRow(stats, t(mapping.labelKey), captionLabel, t)];
  });

  return rows.length > 0
    ? {
        groups: [
          { label: t(CatalogI18nKeys.DetailsLimitsTokenGroupLabel), rows },
        ],
        status: getOverallStatus(usableStats),
      }
    : undefined;
};
