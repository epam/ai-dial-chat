import type {
  DeploymentItemDto,
  DeploymentLimitsResponseDto,
  LimitStatsDto,
  UserLimitStatsResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { DeploymentItemDtoTypeEnum } from '@epam/ai-dial-chat-api-client';
import { formatCost } from '@epam/ai-dial-chat-shared';
import type {
  ModelLimitMetricCell,
  ModelLimitPeriodCell,
  ModelLimitPeriodStatus,
  ModelLimitPeriodStatuses,
  ModelLimitRow,
} from '../models/model-limits-props';
import {
  ModelLimitMetricKind,
  ModelLimitStatus,
} from '../models/model-limits-props';

/** A translate function compatible with i18next's `TFunction`. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A callback that resolves an icon URL from a deployment's raw `iconUrl` field. */
type ResolveIconUrl = (iconUrl: string | undefined) => string | undefined;

/** A callback that resolves a display name from a localized-text value. */
type ResolveDisplayName = (
  name: string | Record<string, string> | undefined | null,
  locale: string,
) => string;

/** Upstream sentinel (`Long.MAX_VALUE` exceeds this): a `total` at or above it means "unlimited". */
const UNLIMITED_TOTAL_THRESHOLD = 2 ** 53;

/** Percentage at/above which a metric is `RunningLow`; at/above 100 it's `LimitReached`; otherwise `WithinLimits`. */
const RUNNING_LOW_THRESHOLD_PERCENT = 75;

/** Formats Tokens metric values with compact K/M suffixes, e.g. `1.6M`, `900K`, `410`. */
const numberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Formats Tokens values in full for `aria-label` text, e.g. `1,600,000` instead of `1.6M`. */
const fullNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/**
 * i18n key strings that the consuming app's translation bundle must define for
 * `mapUserUsageToModelLimits` and `mapOverallCostLimitsToPeriodStatuses` to produce
 * correctly translated strings. The values are the default key paths used by AI DIAL Chat.
 */
export const USAGE_MODEL_LIMITS_I18N_KEYS = {
  /** Period label used in tooltip text. Receives no interpolation. */
  todayPeriodDescription: 'usage.todayPeriodDescription',
  /** Period label used in tooltip text. Receives no interpolation. */
  thisWeekPeriodDescription: 'usage.thisWeekPeriodDescription',
  /** Period label used in tooltip text. Receives no interpolation. */
  thisMonthPeriodDescription: 'usage.thisMonthPeriodDescription',
  /** Tooltip when the overall cost limit is running low. Receives `{ period: string }`. */
  overallCostLimitRunningLowTooltip: 'usage.overallCostLimitRunningLowTooltip',
  /** Tooltip when the overall cost limit is reached. Receives `{ period: string }`. */
  overallCostLimitReachedTooltip: 'usage.overallCostLimitReachedTooltip',
  /** Aria label for a metric cell with no data. */
  unavailableLabel: 'usage.unavailableLabel',
  /** Supporting label when a token limit follows the cost limit. */
  followsCostLimitLabel: 'usage.followsCostLimitLabel',
  /** Supporting label when there is no per-deployment token limit. */
  noLimitLabel: 'usage.noLimitLabel',
  /** Aria label when token usage has no limit but follows the cost limit. Receives `{ used: string }`. */
  followsCostLimitAriaLabel: 'usage.followsCostLimitAriaLabel',
  /** Aria label when there is no limit. Receives `{ used: string }`. */
  unlimitedProgressAriaLabel: 'usage.unlimitedProgressAriaLabel',
  /** Aria label for a progress bar with a finite limit. Receives `{ used: string, total: string, percent: number }`. */
  progressAriaLabel: 'usage.progressAriaLabel',
  /** Label for the spent-cost cell. Receives `{ amount: string }`. */
  spentLabel: 'usage.spentLabel',
} as const;

/**
 * Which `DeploymentLimitsResponseDto` fields back one fixed comparison-period column.
 */
interface PeriodFieldMapping {
  cost: keyof DeploymentLimitsResponseDto;
  tokens: keyof DeploymentLimitsResponseDto;
}

const PERIOD_FIELD_MAPPINGS = {
  last24Hours: {
    cost: 'dayCostStats',
    tokens: 'dayTokenStats',
  },
  last7Days: {
    cost: 'weekCostStats',
    tokens: 'weekTokenStats',
  },
  last30Days: {
    cost: 'monthCostStats',
    tokens: 'monthTokenStats',
  },
} satisfies Record<
  'last24Hours' | 'last7Days' | 'last30Days',
  PeriodFieldMapping
>;

const OVERALL_COST_PERIODS = {
  last24Hours: {
    field: 'dayCostStats',
    labelKey: USAGE_MODEL_LIMITS_I18N_KEYS.todayPeriodDescription,
  },
  last7Days: {
    field: 'weekCostStats',
    labelKey: USAGE_MODEL_LIMITS_I18N_KEYS.thisWeekPeriodDescription,
  },
  last30Days: {
    field: 'monthCostStats',
    labelKey: USAGE_MODEL_LIMITS_I18N_KEYS.thisMonthPeriodDescription,
  },
} satisfies Record<
  keyof ModelLimitPeriodStatuses,
  {
    field: 'dayCostStats' | 'weekCostStats' | 'monthCostStats';
    labelKey: string;
  }
>;

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

const getOverallCostStatus = (
  stats: LimitStatsDto | undefined,
): ModelLimitStatus => {
  if (!isUsableStats(stats)) {
    return ModelLimitStatus.Unavailable;
  }
  if (stats.total >= UNLIMITED_TOTAL_THRESHOLD) {
    return ModelLimitStatus.NoLimit;
  }

  const used = Math.max(0, stats.used);
  const total = Math.max(0, stats.total);
  const usedPercent = total > 0 ? (used / total) * 100 : 100;
  return getMetricStatus(usedPercent);
};

const isFiniteLimitStatus = (status: ModelLimitStatus): boolean =>
  status === ModelLimitStatus.WithinLimits ||
  status === ModelLimitStatus.RunningLow ||
  status === ModelLimitStatus.LimitReached;

const buildOverallCostPeriodStatus = (
  usage: UserLimitStatsResponseDto | undefined,
  period: (typeof OVERALL_COST_PERIODS)[keyof ModelLimitPeriodStatuses],
  activeLocale: string,
  t: Translate,
): ModelLimitPeriodStatus => {
  const status = getOverallCostStatus(usage?.[period.field]);
  const periodLabel = t(period.labelKey).toLocaleLowerCase(activeLocale);
  const tooltipLabel =
    status === ModelLimitStatus.LimitReached
      ? t(USAGE_MODEL_LIMITS_I18N_KEYS.overallCostLimitReachedTooltip, {
          period: periodLabel,
        })
      : status === ModelLimitStatus.RunningLow
        ? t(USAGE_MODEL_LIMITS_I18N_KEYS.overallCostLimitRunningLowTooltip, {
            period: periodLabel,
          })
        : undefined;

  return { status, tooltipLabel };
};

/** Maps the same top-level Cost budgets used by the aggregate cards into table-header state. */
export const mapOverallCostLimitsToPeriodStatuses = (
  usage: UserLimitStatsResponseDto | undefined,
  activeLocale: string,
  t: Translate,
): ModelLimitPeriodStatuses => ({
  last24Hours: buildOverallCostPeriodStatus(
    usage,
    OVERALL_COST_PERIODS.last24Hours,
    activeLocale,
    t,
  ),
  last7Days: buildOverallCostPeriodStatus(
    usage,
    OVERALL_COST_PERIODS.last7Days,
    activeLocale,
    t,
  ),
  last30Days: buildOverallCostPeriodStatus(
    usage,
    OVERALL_COST_PERIODS.last30Days,
    activeLocale,
    t,
  ),
});

const buildUnavailableCell = (t: Translate): ModelLimitMetricCell => ({
  kind: ModelLimitMetricKind.Unavailable,
  ariaLabel: t(USAGE_MODEL_LIMITS_I18N_KEYS.unavailableLabel),
});

/*
 * Classifies a Tokens stat into a finite (progress-capable), unlimited, or unavailable
 * cell. Never treats a missing/invalid stat as zero usage or as unlimited.
 */
const buildFiniteMetricCell = (
  stats: LimitStatsDto | undefined,
  overallCostStatus: ModelLimitStatus,
  t: Translate,
): ModelLimitMetricCell => {
  if (!isUsableStats(stats)) {
    return buildUnavailableCell(t);
  }

  const used = Math.max(0, stats.used);
  const usedLabel = numberFormatter.format(used);

  if (stats.total >= UNLIMITED_TOTAL_THRESHOLD) {
    const followsCostLimit = isFiniteLimitStatus(overallCostStatus);
    return {
      kind: ModelLimitMetricKind.Unlimited,
      usedLabel,
      supportingLabel: followsCostLimit
        ? t(USAGE_MODEL_LIMITS_I18N_KEYS.followsCostLimitLabel)
        : t(USAGE_MODEL_LIMITS_I18N_KEYS.noLimitLabel),
      ariaLabel: t(
        followsCostLimit
          ? USAGE_MODEL_LIMITS_I18N_KEYS.followsCostLimitAriaLabel
          : USAGE_MODEL_LIMITS_I18N_KEYS.unlimitedProgressAriaLabel,
        { used: fullNumberFormatter.format(used) },
      ),
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
    ariaLabel: t(USAGE_MODEL_LIMITS_I18N_KEYS.progressAriaLabel, {
      used: fullNumberFormatter.format(used),
      total: fullNumberFormatter.format(total),
      percent: Math.round(usedPercent),
    }),
  };
};

/*
 * Classifies the Cost stat. Per the upstream contract, a well-formed per-deployment cost entry is
 * always the unlimited sentinel (attributed spend against no per-deployment cap) — this never
 * produces a `Finite` cell or a finite cost status, regardless of the reported `total`.
 */
const buildCostMetricCell = (
  stats: LimitStatsDto | undefined,
  t: Translate,
): ModelLimitMetricCell => {
  if (!isUsableStats(stats)) {
    return buildUnavailableCell(t);
  }

  const used = Math.max(0, stats.used);
  const amountLabel = formatCost(used);
  const usedLabel = t(USAGE_MODEL_LIMITS_I18N_KEYS.spentLabel, {
    amount: amountLabel,
  });

  return {
    kind: ModelLimitMetricKind.Unlimited,
    usedLabel,
    ariaLabel: usedLabel,
  };
};

const buildPeriodCell = (
  deploymentStats: DeploymentLimitsResponseDto,
  fields: PeriodFieldMapping,
  overallCostStatus: ModelLimitStatus,
  t: Translate,
): ModelLimitPeriodCell => ({
  tokens: buildFiniteMetricCell(
    deploymentStats[fields.tokens],
    overallCostStatus,
    t,
  ),
  cost: buildCostMetricCell(deploymentStats[fields.cost], t),
});

/** Reduces the three rolling-period Tokens cells to the row's most severe status. */
const getRowStatus = (
  tokenCells: ModelLimitMetricCell[],
  overallCostStatuses: ModelLimitStatus[],
): ModelLimitStatus => {
  const tokenStatuses = tokenCells
    .filter((cell) => cell.kind === ModelLimitMetricKind.Finite)
    .map((cell) => cell.status);
  const finiteStatuses = [...tokenStatuses, ...overallCostStatuses].filter(
    (status) => status != null && isFiniteLimitStatus(status),
  );

  if (finiteStatuses.includes(ModelLimitStatus.LimitReached)) {
    return ModelLimitStatus.LimitReached;
  }
  if (finiteStatuses.includes(ModelLimitStatus.RunningLow)) {
    return ModelLimitStatus.RunningLow;
  }
  if (finiteStatuses.includes(ModelLimitStatus.WithinLimits)) {
    return ModelLimitStatus.WithinLimits;
  }
  if (
    tokenCells.some((cell) => cell.kind === ModelLimitMetricKind.Unlimited) ||
    overallCostStatuses.includes(ModelLimitStatus.NoLimit)
  ) {
    return ModelLimitStatus.NoLimit;
  }
  return ModelLimitStatus.Unavailable;
};

/** Whether at least one displayed day/week/month Cost or Tokens stat has nonzero usage. */
const hasUsageAcrossDisplayedPeriods = (
  stats: (LimitStatsDto | undefined)[],
): boolean => stats.some((stat) => isUsableStats(stat) && stat.used > 0);

/**
 * Maps `usage.deployments` into `ModelLimitsSection`'s `rows` prop, joined with model identity
 * from `deploymentItems`. Rows are included only when any displayed period stat has nonzero usage.
 * Order follows `Object.keys(deployments)` — `deploymentItems` is enrichment-only.
 *
 * @param resolveIconUrl - Resolves a deployment's raw `iconUrl` to the URL the avatar should load.
 * @param resolveDisplayName - Resolves a localized-text map or plain string to the display name for `activeLocale`.
 */
export const mapUserUsageToModelLimits = (
  usage: UserLimitStatsResponseDto | undefined,
  deploymentItems: DeploymentItemDto[],
  activeLocale: string,
  t: Translate,
  resolveIconUrl: ResolveIconUrl,
  resolveDisplayName: ResolveDisplayName,
): ModelLimitRow[] => {
  const deployments = usage?.deployments;
  if (deployments == null) {
    return [];
  }

  const modelItemById = new Map(
    deploymentItems
      .filter((item) => item.type === DeploymentItemDtoTypeEnum.Model)
      .map((item) => [item.id, item]),
  );
  const periodStatuses = mapOverallCostLimitsToPeriodStatuses(
    usage,
    activeLocale,
    t,
  );

  return Object.keys(deployments)
    .map((id) => {
      const item = modelItemById.get(id);
      const name =
        item != null
          ? resolveDisplayName(item.displayName, activeLocale) || item.id
          : id;
      const deploymentStats = deployments[id];
      const avatarSrc = resolveIconUrl(item?.iconUrl);

      const last24Hours = buildPeriodCell(
        deploymentStats,
        PERIOD_FIELD_MAPPINGS.last24Hours,
        periodStatuses.last24Hours.status,
        t,
      );
      const last7Days = buildPeriodCell(
        deploymentStats,
        PERIOD_FIELD_MAPPINGS.last7Days,
        periodStatuses.last7Days.status,
        t,
      );
      const last30Days = buildPeriodCell(
        deploymentStats,
        PERIOD_FIELD_MAPPINGS.last30Days,
        periodStatuses.last30Days.status,
        t,
      );

      const displayedStats = Object.values(PERIOD_FIELD_MAPPINGS).flatMap(
        ({ cost, tokens }) => [deploymentStats[cost], deploymentStats[tokens]],
      );

      return {
        row: {
          id,
          name,
          version: item?.displayVersion,
          avatarSrc,
          last24Hours,
          last7Days,
          last30Days,
          status: getRowStatus(
            [last24Hours.tokens, last7Days.tokens, last30Days.tokens],
            [
              periodStatuses.last24Hours.status,
              periodStatuses.last7Days.status,
              periodStatuses.last30Days.status,
            ],
          ),
        },
        hasUsage: hasUsageAcrossDisplayedPeriods(displayedStats),
      };
    })
    .filter(({ hasUsage }) => hasUsage)
    .map(({ row }) => row);
};
