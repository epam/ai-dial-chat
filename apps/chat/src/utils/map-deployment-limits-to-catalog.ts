import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { CatalogI18nKeys } from '../constants/translation-keys';

interface DeploymentLimitMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelKey: CatalogI18nKeys;
}

const LIMIT_STAT_MAPPINGS: DeploymentLimitMapping[] = [
  {
    key: 'hourRequestStats',
    labelKey: CatalogI18nKeys.DetailsLimitsRequestsPerHour,
  },
  {
    key: 'dayRequestStats',
    labelKey: CatalogI18nKeys.DetailsLimitsRequestsPerDay,
  },
  {
    key: 'minuteTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerMinute,
  },
  {
    key: 'dayTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerDay,
  },
  {
    key: 'weekTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerWeek,
  },
  {
    key: 'monthTokenStats',
    labelKey: CatalogI18nKeys.DetailsLimitsTokensPerMonth,
  },
  {
    key: 'minuteCostStats',
    labelKey: CatalogI18nKeys.DetailsLimitsCostPerMinute,
  },
  {
    key: 'dayCostStats',
    labelKey: CatalogI18nKeys.DetailsLimitsCostPerDay,
  },
  {
    key: 'weekCostStats',
    labelKey: CatalogI18nKeys.DetailsLimitsCostPerWeek,
  },
  {
    key: 'monthCostStats',
    labelKey: CatalogI18nKeys.DetailsLimitsCostPerMonth,
  },
];

const UNLIMITED_TOTAL_THRESHOLD = Number.MAX_SAFE_INTEGER;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

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

const formatLimitNumber = (value: number): string =>
  numberFormatter.format(value);

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  t: TFunction,
): UsageLimitProgressRow => {
  const used = Math.max(0, stats.used);
  const total = stats.total;
  const formattedUsed = formatLimitNumber(used);
  const formattedTotal = formatLimitNumber(total);
  const isUnlimited = isUnlimitedTotal(total);

  return {
    label,
    used,
    total,
    ...(isUnlimited ? { isUnlimited: true } : {}),
    valueLabel: isUnlimited
      ? t(CatalogI18nKeys.DetailsLimitsUnlimitedValue)
      : t(CatalogI18nKeys.DetailsLimitsValue, {
          used: formattedUsed,
          total: formattedTotal,
        }),
    ariaLabel: t(CatalogI18nKeys.DetailsLimitsProgressAriaLabel, {
      label,
      used: formattedUsed,
      total: isUnlimited
        ? t(CatalogI18nKeys.DetailsLimitsUnlimitedValue)
        : formattedTotal,
    }),
  };
};

export const mapDeploymentLimitsDtoToCatalogLimits = (
  dto: DeploymentLimitsResponseDto | undefined,
  t: TFunction,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const rows = LIMIT_STAT_MAPPINGS.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!shouldShowLimitStats(stats)) {
      return [];
    }

    return [mapLimitStatsToRow(stats, t(mapping.labelKey), t)];
  });

  return rows.length > 0 ? { rows } : undefined;
};
