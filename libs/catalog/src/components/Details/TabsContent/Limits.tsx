import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '../../../models/item-details-data';
import styles from './Limits.module.scss';

const getProgressValue = (row: UsageLimitProgressRow): number => {
  if (!Number.isFinite(row.used) || !Number.isFinite(row.total)) {
    return 0;
  }

  return Math.min(Math.max(row.used, 0), Math.max(row.total, 0));
};

const getProgressMax = (total: number): number =>
  Number.isFinite(total) && total > 0 ? total : 1;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const getValueLabel = ({ used, total, valueLabel }: UsageLimitProgressRow) =>
  valueLabel ??
  `${numberFormatter.format(used)} / ${numberFormatter.format(total)}`;

const hasProgress = ({ total }: UsageLimitProgressRow) =>
  Number.isFinite(total) && total > 0;

const isCapped = (row: UsageLimitProgressRow) =>
  row.isUnlimited !== true && hasProgress(row);

/** Fraction of the limit consumed so far, clamped to `[0, Infinity)`; `0` when `total` isn't usable. */
const getUsageRatio = (row: UsageLimitProgressRow): number =>
  hasProgress(row) ? Math.max(row.used, 0) / row.total : 0;

enum ProgressStatus {
  Default = 'default',
  Warning = 'warning',
  Danger = 'danger',
}

const getProgressStatus = (row: UsageLimitProgressRow): ProgressStatus => {
  const ratio = getUsageRatio(row);
  if (ratio >= 1) {
    return ProgressStatus.Danger;
  }
  if (ratio >= 0.75) {
    return ProgressStatus.Warning;
  }
  return ProgressStatus.Default;
};

/** Color overrides for `LimitsTab`, applied as CSS custom properties. */
export interface LimitsTabColors {
  /** Section heading text color. Fallback: `--text-secondary`. */
  sectionHeading?: string;
  /** Row label text color, for both capped and unlimited rows. Fallback: `--text-secondary`. */
  label?: string;
  /** Row value text color, for both capped and unlimited rows. Fallback: `--text-secondary`. */
  value?: string;
  /** Progress-bar track color for capped rows. Fallback: `--bg-layer-sunken`. */
  progressTrack?: string;
  /** Progress-bar fill color below 75% usage. Fallback: `--text-control-accent-hover`. */
  progressFillDefault?: string;
  /** Progress-bar fill color once usage reaches 75% of the limit. Fallback: `--text-warning-icon`. */
  progressFillWarning?: string;
  /** Progress-bar fill color once usage reaches (or exceeds) the limit. Fallback: `--bg-control-error-active`. */
  progressFillDanger?: string;
}

/** Props for `LimitsTab`. */
export interface LimitsTabProps {
  /** Limits data to render. */
  limits?: CatalogItemLimits;
  /** "Cost caps" section heading, shown above capped/progress rows. Defaults to `'Cost caps'`. */
  costCapsSectionLabel?: string;
  /** "Unlimited" section heading, shown above unlimited rows. Defaults to `'Unlimited'`. */
  unlimitedSectionLabel?: string;
  /** CSS class for capped-row labels. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for unlimited-row labels. Defaults to `'dial-tiny-text'`. */
  unlimitedLabelClassName?: string;
  /** CSS class for capped-row values. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
  /** CSS class for unlimited-row values, including the "Unlimited" text. Defaults to `'dial-tiny-text'`. */
  unlimitedValueClassName?: string;
  /** CSS class for section headings. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
  /** CSS class for a capped row's limit (total) figure, heavier than `valueClassName`. Defaults to `'dial-small-semi-text'`. */
  limitClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: LimitsTabColors;
}

/** Renders model usage limits, split into a "cost caps" progress-bar section and an "unlimited" rows section. */
export const LimitsTab: FC<LimitsTabProps> = ({
  limits,
  costCapsSectionLabel = 'Cost caps',
  unlimitedSectionLabel = 'Unlimited',
  labelClassName = 'dial-small-semi-text',
  unlimitedLabelClassName = 'dial-tiny-text',
  valueClassName = 'dial-small-text',
  unlimitedValueClassName = 'dial-tiny-text',
  sectionClassName = 'dial-caption-text',
  limitClassName = 'dial-small-semi-text',
  colors,
}) => {
  if (limits == null || limits.rows.length === 0) {
    return null;
  }

  const cappedRows = limits.rows.filter(isCapped);
  const unlimitedRows = limits.rows.filter((row) => !isCapped(row));

  const cssVars = buildCssVars({
    '--lt-section-heading': colors?.sectionHeading,
    '--lt-label': colors?.label,
    '--lt-value': colors?.value,
    '--lt-progress-track': colors?.progressTrack,
    '--lt-progress-fill-default': colors?.progressFillDefault,
    '--lt-progress-fill-warning': colors?.progressFillWarning,
    '--lt-progress-fill-danger': colors?.progressFillDanger,
  });

  return (
    <div className="flex flex-col gap-6" style={cssVars}>
      {cappedRows.length > 0 && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {costCapsSectionLabel}
          </p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {cappedRows.map((row) => {
              const valueLabel = getValueLabel(row);
              const status = getProgressStatus(row);

              return (
                <li key={row.label}>
                  <ProgressBar
                    value={getProgressValue(row)}
                    max={getProgressMax(row.total)}
                    size={ElementSize.Small}
                    className={mergeClasses(
                      '!h-2 w-full',
                      styles.progressTrack,
                      status === ProgressStatus.Default &&
                        styles.progressFillDefault,
                      status === ProgressStatus.Warning &&
                        styles.progressFillWarning,
                      status === ProgressStatus.Danger &&
                        styles.progressFillDanger,
                    )}
                    labelProps={{
                      label: (
                        <span
                          className={mergeClasses(labelClassName, styles.label)}
                        >
                          {row.label}
                        </span>
                      ),
                    }}
                    valueLabel={
                      row.usedLabel != null && row.totalLabel != null ? (
                        <>
                          <span
                            className={mergeClasses(
                              valueClassName,
                              styles.value,
                            )}
                          >
                            {row.usedLabel}
                          </span>{' '}
                          /{' '}
                          <span
                            className={mergeClasses(
                              limitClassName,
                              styles.value,
                            )}
                          >
                            {row.totalLabel}
                          </span>
                        </>
                      ) : (
                        <span
                          className={mergeClasses(valueClassName, styles.value)}
                        >
                          {valueLabel}
                        </span>
                      )
                    }
                    aria-valuetext={row.ariaLabel ?? valueLabel}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unlimitedRows.length > 0 && (
        <section>
          <p
            className={mergeClasses(
              'mb-3 mt-0',
              sectionClassName,
              styles.sectionHeading,
            )}
          >
            {unlimitedSectionLabel}
          </p>
          <ul className="m-0 list-none p-0">
            {unlimitedRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 py-[4.8px]"
              >
                <span
                  className={mergeClasses(
                    'min-w-0 break-words',
                    unlimitedLabelClassName,
                    styles.label,
                  )}
                >
                  {row.label}
                </span>
                <span
                  className={mergeClasses(
                    'shrink-0',
                    unlimitedValueClassName,
                    styles.value,
                  )}
                >
                  {getValueLabel(row)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
