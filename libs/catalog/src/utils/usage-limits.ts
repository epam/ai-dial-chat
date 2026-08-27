import type { UsageLimitProgressRow } from '../models/item-details-data';

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export enum ProgressStatus {
  Default = 'default',
  Warning = 'warning',
  Danger = 'danger',
}

export const getProgressValue = (row: UsageLimitProgressRow): number => {
  if (!Number.isFinite(row.used) || !Number.isFinite(row.total)) {
    return 0;
  }

  return Math.min(Math.max(row.used, 0), Math.max(row.total, 0));
};

export const getProgressMax = (total: number): number =>
  Number.isFinite(total) && total > 0 ? total : 1;

export const getValueLabel = ({
  used,
  total,
  valueLabel,
}: UsageLimitProgressRow) =>
  valueLabel ??
  `${numberFormatter.format(used)} / ${numberFormatter.format(total)}`;

export const hasProgress = ({ total }: UsageLimitProgressRow) =>
  Number.isFinite(total) && total > 0;

export const isCapped = (row: UsageLimitProgressRow) =>
  row.isUnlimited !== true && hasProgress(row);

/** Fraction of the limit consumed so far, clamped to `[0, Infinity)`; `0` when `total` isn't usable. */
export const getUsageRatio = (row: UsageLimitProgressRow): number =>
  hasProgress(row) ? Math.max(row.used, 0) / row.total : 0;

export const getProgressStatus = (
  row: UsageLimitProgressRow,
): ProgressStatus => {
  const ratio = getUsageRatio(row);
  if (ratio >= 1) {
    return ProgressStatus.Danger;
  }
  if (ratio >= 0.75) {
    return ProgressStatus.Warning;
  }
  return ProgressStatus.Default;
};
