import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentLimitsResponseDto,
  LimitStatsDto,
} from '@epam/ai-dial-chat-api-client';

/** Labels and formatter callbacks for the deployment-limits mapping utility. */
export interface DeploymentLimitsLabels {
  /** Label for the requests-per-hour stat row. */
  requestsPerHour: string;
  /** Label for the requests-per-day stat row. */
  requestsPerDay: string;
  /** Label for the tokens-per-minute stat row. */
  tokensPerMinute: string;
  /** Label for the tokens-per-day stat row. */
  tokensPerDay: string;
  /** Label for the tokens-per-week stat row. */
  tokensPerWeek: string;
  /** Label for the tokens-per-month stat row. */
  tokensPerMonth: string;
  /** Label for the cost-per-minute stat row. */
  costPerMinute: string;
  /** Label for the cost-per-day stat row. */
  costPerDay: string;
  /** Label for the cost-per-week stat row. */
  costPerWeek: string;
  /** Label for the cost-per-month stat row. */
  costPerMonth: string;
  /** Display value shown when a stat's total is unlimited. */
  unlimitedValue: string;
  /** Formats the combined used/total display value for a non-unlimited row. */
  formatValueLabel: (used: string, total: string) => string;
  /** Formats the ARIA label for a progress row. */
  formatProgressAriaLabel: (params: {
    label: string;
    used: string;
    total: string;
  }) => string;
}

type StatLabelField = Exclude<
  keyof DeploymentLimitsLabels,
  'unlimitedValue' | 'formatValueLabel' | 'formatProgressAriaLabel'
>;

interface DeploymentLimitMapping {
  key: keyof DeploymentLimitsResponseDto;
  labelField: StatLabelField;
  /* Whether this stat is denominated in cost (USD), formatted with a currency symbol. */
  isCost?: boolean;
}

const LIMIT_STAT_MAPPINGS: DeploymentLimitMapping[] = [
  { key: 'hourRequestStats', labelField: 'requestsPerHour' },
  { key: 'dayRequestStats', labelField: 'requestsPerDay' },
  { key: 'minuteTokenStats', labelField: 'tokensPerMinute' },
  { key: 'dayTokenStats', labelField: 'tokensPerDay' },
  { key: 'weekTokenStats', labelField: 'tokensPerWeek' },
  { key: 'monthTokenStats', labelField: 'tokensPerMonth' },
  { key: 'minuteCostStats', labelField: 'costPerMinute', isCost: true },
  { key: 'dayCostStats', labelField: 'costPerDay', isCost: true },
  { key: 'weekCostStats', labelField: 'costPerWeek', isCost: true },
  { key: 'monthCostStats', labelField: 'costPerMonth', isCost: true },
];

const UNLIMITED_TOTAL_THRESHOLD = Number.MAX_SAFE_INTEGER;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const costFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
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

const formatLimitNumber = (value: number, isCost: boolean): string =>
  isCost ? costFormatter.format(value) : numberFormatter.format(value);

const mapLimitStatsToRow = (
  stats: LimitStatsDto,
  label: string,
  labels: DeploymentLimitsLabels,
  isCost: boolean,
): UsageLimitProgressRow => {
  const used = Math.max(0, stats.used);
  const total = stats.total;
  const formattedUsed = formatLimitNumber(used, isCost);
  const formattedTotal = formatLimitNumber(total, isCost);
  const isUnlimited = isUnlimitedTotal(total);

  return {
    label,
    used,
    total,
    ...(isUnlimited
      ? { isUnlimited: true }
      : { usedLabel: formattedUsed, totalLabel: formattedTotal }),
    valueLabel: isUnlimited
      ? labels.unlimitedValue
      : labels.formatValueLabel(formattedUsed, formattedTotal),
    ariaLabel: labels.formatProgressAriaLabel({
      label,
      used: formattedUsed,
      total: isUnlimited ? labels.unlimitedValue : formattedTotal,
    }),
  };
};

/** Maps a deployment limits DTO to display-ready catalog limits, or `undefined` when no qualifying stats exist. */
export const mapDeploymentLimitsDtoToCatalogLimits = (
  dto: DeploymentLimitsResponseDto | undefined,
  labels: DeploymentLimitsLabels,
): CatalogItemLimits | undefined => {
  if (dto == null) {
    return undefined;
  }

  const rows = LIMIT_STAT_MAPPINGS.flatMap((mapping) => {
    const stats = dto[mapping.key];
    if (!isUsableLimitStats(stats)) {
      return [];
    }

    return [
      mapLimitStatsToRow(
        stats,
        labels[mapping.labelField],
        labels,
        mapping.isCost ?? false,
      ),
    ];
  });

  return rows.length > 0 ? { rows } : undefined;
};
