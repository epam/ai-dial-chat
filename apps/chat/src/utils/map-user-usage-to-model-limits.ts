import type {
  DeploymentItemDto,
  DeploymentLimitsResponseDto,
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitRow,
  ModelLimitsPeriod,
  ModelLimitStatus,
} from '@epam/ai-dial-usage-dashboard';
import type { TFunction } from 'i18next';
import { UsageI18nKeys } from '../constants/translation-keys';
import { resolveCatalogIconUrl } from './icon-path';
import { resolveLocalizedText } from './locale';

/** Upstream sentinel (`Long.MAX_VALUE` exceeds this): a `total` at or above it means "unlimited". */
const UNLIMITED_TOTAL_THRESHOLD = 2 ** 53;

/** Percentage at/above which a metric is `RunningLow`; at/above 100 it's `LimitReached`; otherwise `WithinLimits`. */
const RUNNING_LOW_THRESHOLD_PERCENT = 75;

/** Formats Tokens/Requests metric values with compact K/M suffixes, e.g. `1.6M`, `900K`, `410`. */
const numberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formats Tokens/Requests values in full for `aria-label` text, e.g. `1,600,000` instead of `1.6M`. */
const fullNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/**
 * Which `DeploymentLimitsResponseDto` field backs each column for a period. A period may omit a
 * field entirely — the upstream contract only has minute/day/week/month granularity for Cost and
 * Tokens, and only hour/day granularity for Requests — in which case that column is `Unavailable`
 * for that period, never a fallback to a different period's field.
 */
interface PeriodFieldMapping {
  cost?: keyof DeploymentLimitsResponseDto;
  tokens?: keyof DeploymentLimitsResponseDto;
  requests?: keyof DeploymentLimitsResponseDto;
}

const PERIOD_FIELD_MAPPINGS: Record<ModelLimitsPeriod, PeriodFieldMapping> = {
  [ModelLimitsPeriod.LastMinute]: {
    cost: 'minuteCostStats',
    tokens: 'minuteTokenStats',
  },
  [ModelLimitsPeriod.LastHour]: {
    requests: 'hourRequestStats',
  },
  [ModelLimitsPeriod.Last24Hours]: {
    cost: 'dayCostStats',
    tokens: 'dayTokenStats',
    requests: 'dayRequestStats',
  },
  [ModelLimitsPeriod.Last7Days]: {
    cost: 'weekCostStats',
    tokens: 'weekTokenStats',
  },
  [ModelLimitsPeriod.Last30Days]: {
    cost: 'monthCostStats',
    tokens: 'monthTokenStats',
  },
};

const isUsableStats = (
  stats: LimitStatsDto | undefined,
): stats is LimitStatsDto =>
  stats != null && Number.isFinite(stats.total) && Number.isFinite(stats.used);

const getMetricStatus = (usedPercent: number): ModelLimitStatus => {
  if (usedPercent >= 100) {
    return ModelLimitStatus.LimitReached;
  }
  if (usedPercent >= RUNNING_LOW_THRESHOLD_PERCENT) {
    return ModelLimitStatus.RunningLow;
  }
  return ModelLimitStatus.WithinLimits;
};

const buildUnavailableCell = (t: TFunction): ModelLimitMetricCell => ({
  kind: ModelLimitMetricKind.Unavailable,
  ariaLabel: t(UsageI18nKeys.UnavailableLabel),
});

/**
 * Classifies a Tokens/Requests stat into a finite (progress-capable), unlimited, or unavailable
 * cell. Never treats a missing/invalid stat as zero usage or as unlimited.
 */
const buildFiniteMetricCell = (
  stats: LimitStatsDto | undefined,
  t: TFunction,
): ModelLimitMetricCell => {
  if (!isUsableStats(stats)) {
    return buildUnavailableCell(t);
  }

  const used = Math.max(0, stats.used);
  const usedLabel = numberFormatter.format(used);

  if (stats.total >= UNLIMITED_TOTAL_THRESHOLD) {
    return {
      kind: ModelLimitMetricKind.Unlimited,
      usedLabel,
      ariaLabel: t(UsageI18nKeys.UnlimitedProgressAriaLabel, {
        used: fullNumberFormatter.format(used),
      }),
    };
  }

  const total = Math.max(stats.total, 0);
  const totalLabel = numberFormatter.format(total);
  const usedPercent = total > 0 ? (used / total) * 100 : 100;
  const status = getMetricStatus(usedPercent);

  return {
    kind: ModelLimitMetricKind.Finite,
    usedLabel,
    totalLabel,
    usedPercent,
    status,
    ariaLabel: t(UsageI18nKeys.ProgressAriaLabel, {
      used: fullNumberFormatter.format(used),
      total: fullNumberFormatter.format(total),
      percent: Math.round(usedPercent),
    }),
  };
};

/**
 * Classifies the Cost stat. Per the upstream contract, a well-formed per-deployment cost entry is
 * always the unlimited sentinel (attributed spend against no per-deployment cap) — this never
 * produces a `Finite` cell or a finite cost status, regardless of the reported `total`.
 */
const buildCostMetricCell = (
  stats: LimitStatsDto | undefined,
  t: TFunction,
): ModelLimitMetricCell => {
  if (!isUsableStats(stats)) {
    return buildUnavailableCell(t);
  }

  const used = Math.max(0, stats.used);
  const usedLabel = formatCost(used);

  return {
    kind: ModelLimitMetricKind.Unlimited,
    usedLabel,
    ariaLabel: t(UsageI18nKeys.UnlimitedProgressAriaLabel, { used: usedLabel }),
  };
};

/**
 * Reduces a row's three metric cells to its overall status: the most severe status among its
 * `Finite` metrics; `NoLimit` when every metric is `Unlimited`; `Unavailable` when no metric is
 * usable at all (`Finite` or `Unlimited`).
 */
const getRowStatus = (cells: ModelLimitMetricCell[]): ModelLimitStatus => {
  const finiteStatuses = cells
    .filter((cell) => cell.kind === ModelLimitMetricKind.Finite)
    .map((cell) => cell.status);

  if (finiteStatuses.includes(ModelLimitStatus.LimitReached)) {
    return ModelLimitStatus.LimitReached;
  }
  if (finiteStatuses.includes(ModelLimitStatus.RunningLow)) {
    return ModelLimitStatus.RunningLow;
  }
  if (finiteStatuses.includes(ModelLimitStatus.WithinLimits)) {
    return ModelLimitStatus.WithinLimits;
  }
  if (cells.some((cell) => cell.kind === ModelLimitMetricKind.Unlimited)) {
    return ModelLimitStatus.NoLimit;
  }
  return ModelLimitStatus.Unavailable;
};

/**
 * Whether at least one of a row's period-mapped raw stats is usable and has nonzero `used` — the
 * signal that the deployment actually has usage in the selected period, as opposed to merely
 * having an entry in `usage.deployments` (which may reflect usage in a different period only).
 */
const hasUsageInPeriod = (stats: (LimitStatsDto | undefined)[]): boolean =>
  stats.some((stat) => isUsableStats(stat) && stat.used > 0);

/**
 * Maps `usage.deployments` (already fetched by `useUsageData`) into `ModelLimitsSection`'s `rows`
 * prop, joined with model identity from `useDeployments().items`. Never calls a new endpoint —
 * everything here is derived from data already in memory. Candidate rows come from exactly the
 * entries present in `usage.deployments` (no accessible-but-unused models added from `items`), but
 * the returned rows are further scoped to the selected period: a candidate is dropped unless at
 * least one of its Cost/Tokens/Requests stats mapped for that period is usable and has `used > 0`.
 * Among rows that pass this filter, order follows `Object.keys(deployments)` order, so row set and
 * order depend only on the `usage` fetch and the selected period, and stay stable regardless of
 * whether/when `items` has loaded. `items` is used solely to enrich a row with display
 * name/version/avatar when a match exists.
 */
export const mapUserUsageToModelLimits = (
  usage: UserLimitStatsResponseDto | undefined,
  items: DeploymentItemDto[],
  period: ModelLimitsPeriod,
  activeLocale: string,
  t: TFunction,
): ModelLimitRow[] => {
  const deployments = usage?.deployments;
  if (deployments == null) {
    return [];
  }

  const modelItemById = new Map(
    items
      .filter((item) => item.type === DeploymentItemDtoTypeEnum.Model)
      .map((item) => [item.id, item]),
  );
  const fieldMapping = PERIOD_FIELD_MAPPINGS[period];

  return Object.keys(deployments)
    .map((id) => {
      const item = modelItemById.get(id);
      const name =
        item != null
          ? resolveLocalizedText(item.displayName, activeLocale) || item.id
          : id;
      const deploymentStats = deployments[id];
      const avatarSrc = resolveCatalogIconUrl(item?.iconUrl);

      const costStats =
        fieldMapping.cost != null
          ? deploymentStats[fieldMapping.cost]
          : undefined;
      const tokenStats =
        fieldMapping.tokens != null
          ? deploymentStats[fieldMapping.tokens]
          : undefined;
      const requestStats =
        fieldMapping.requests != null
          ? deploymentStats[fieldMapping.requests]
          : undefined;

      const cost =
        fieldMapping.cost != null
          ? buildCostMetricCell(costStats, t)
          : buildUnavailableCell(t);
      const tokens =
        fieldMapping.tokens != null
          ? buildFiniteMetricCell(tokenStats, t)
          : buildUnavailableCell(t);
      const requests =
        fieldMapping.requests != null
          ? buildFiniteMetricCell(requestStats, t)
          : buildUnavailableCell(t);

      return {
        row: {
          id,
          name,
          version: item?.displayVersion,
          avatarSrc,
          cost,
          tokens,
          requests,
          status: getRowStatus([cost, tokens, requests]),
        },
        hasUsage: hasUsageInPeriod([costStats, tokenStats, requestStats]),
      };
    })
    .filter(({ hasUsage }) => hasUsage)
    .map(({ row }) => row);
};
