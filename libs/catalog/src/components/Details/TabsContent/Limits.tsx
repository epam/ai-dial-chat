import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import type {
  CatalogItemLimits,
  UsageLimitGroup,
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
  /** Group heading text color. Fallback: `--text-secondary`. */
  sectionHeading?: string;
  /** Row label text color, and the secondary half of a value/note line. Fallback: `--text-secondary`. */
  label?: string;
  /** Emphasized value text color: the used-amount figure of a capped row, and a no-progress row's value. Fallback: `--text-primary`. */
  valuePrimary?: string;
  /** Row divider line color. Fallback: `--stroke-tertiary`. */
  divider?: string;
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
  /** CSS class for a row's label. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for a row's secondary caption under the label (`row.captionLabel`). Defaults to `'dial-caption-text'`. */
  captionClassName?: string;
  /** CSS class for a capped row's used/total figures. Defaults to `'dial-tiny-text'`. */
  valueClassName?: string;
  /** CSS class for a no-progress row's value (e.g. "Unlimited"). Defaults to `'dial-tiny-semi-text'`. */
  noteValueClassName?: string;
  /** CSS class for a no-progress row's secondary caption (`row.noteLabel`). Defaults to `'dial-caption-text'`. */
  noteClassName?: string;
  /** CSS class for each group's heading. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
  /** CSS class for `footerNote`'s wrapper. Defaults to `'dial-caption-text'`. */
  footerClassName?: string;
  /**
   * Footer note rendered below the groups, e.g. a link to a full usage-limits
   * page. Omitted (the default) hides the footer entirely.
   */
  footerNote?: ReactNode;
  /** Color overrides applied as CSS custom properties. */
  colors?: LimitsTabColors;
}

interface LimitRowProps {
  row: UsageLimitProgressRow;
  labelClassName: string;
  captionClassName: string;
  valueClassName: string;
  noteValueClassName: string;
  noteClassName: string;
}

const LimitRow: FC<LimitRowProps> = ({
  row,
  labelClassName,
  captionClassName,
  valueClassName,
  noteValueClassName,
  noteClassName,
}) => {
  const valueLabel = getValueLabel(row);

  return (
    <li
      className={mergeClasses(
        'flex items-center justify-between gap-5 border-b py-4 first:pt-0 last:border-b-0 last:pb-0',
        styles.divider,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={mergeClasses('break-words', labelClassName, styles.label)}
        >
          {row.label}
        </span>
        {row.captionLabel != null && (
          <span
            className={mergeClasses(
              'break-words',
              captionClassName,
              styles.label,
            )}
          >
            {row.captionLabel}
          </span>
        )}
      </div>

      {isCapped(row) ? (
        <div className="flex w-32 shrink-0 flex-col items-end gap-2">
          <div className={mergeClasses('flex gap-1', valueClassName)}>
            {row.usedLabel != null && row.totalLabel != null ? (
              <>
                <span className={styles.valuePrimary}>{row.usedLabel}</span>
                <span className={styles.label}>{` / ${row.totalLabel}`}</span>
              </>
            ) : (
              <span className={styles.label}>{valueLabel}</span>
            )}
          </div>
          <ProgressBar
            value={getProgressValue(row)}
            max={getProgressMax(row.total)}
            size={ElementSize.Small}
            className={mergeClasses(
              '!h-1 w-full',
              styles.progressTrack,
              getProgressStatus(row) === ProgressStatus.Default &&
                styles.progressFillDefault,
              getProgressStatus(row) === ProgressStatus.Warning &&
                styles.progressFillWarning,
              getProgressStatus(row) === ProgressStatus.Danger &&
                styles.progressFillDanger,
            )}
            aria-label={row.label}
            aria-valuetext={row.ariaLabel ?? valueLabel}
          />
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-end">
          <span
            className={mergeClasses(noteValueClassName, styles.valuePrimary)}
          >
            {valueLabel}
          </span>
          {row.noteLabel != null && (
            <span className={mergeClasses(noteClassName, styles.label)}>
              {row.noteLabel}
            </span>
          )}
        </div>
      )}
    </li>
  );
};

interface LimitGroupSectionProps {
  group: UsageLimitGroup;
  sectionClassName: string;
  labelClassName: string;
  captionClassName: string;
  valueClassName: string;
  noteValueClassName: string;
  noteClassName: string;
}

const LimitGroupSection: FC<LimitGroupSectionProps> = ({
  group,
  sectionClassName,
  labelClassName,
  captionClassName,
  valueClassName,
  noteValueClassName,
  noteClassName,
}) => (
  <section>
    <p
      className={mergeClasses(
        'mb-3 mt-0',
        sectionClassName,
        styles.sectionHeading,
      )}
    >
      {group.label}
    </p>
    <ul className="m-0 flex list-none flex-col p-0">
      {group.rows.map((row) => (
        <LimitRow
          key={row.label}
          row={row}
          labelClassName={labelClassName}
          captionClassName={captionClassName}
          valueClassName={valueClassName}
          noteValueClassName={noteValueClassName}
          noteClassName={noteClassName}
        />
      ))}
    </ul>
  </section>
);

/** Renders model usage limits as named groups (e.g. token limits, cost limits), each a list of capped progress rows or plain-value rows. */
export const LimitsTab: FC<LimitsTabProps> = ({
  limits,
  labelClassName = 'dial-small-semi-text',
  captionClassName = 'dial-caption-text',
  valueClassName = 'dial-tiny-text',
  noteValueClassName = 'dial-tiny-semi-text',
  noteClassName = 'dial-caption-text',
  sectionClassName = 'dial-caption-text',
  footerClassName = 'dial-caption-text',
  footerNote,
  colors,
}) => {
  const groups = limits?.groups.filter((group) => group.rows.length > 0);

  if (groups == null || groups.length === 0) {
    return null;
  }

  const cssVars = buildCssVars({
    '--lt-section-heading': colors?.sectionHeading,
    '--lt-label': colors?.label,
    '--lt-value-primary': colors?.valuePrimary,
    '--lt-divider': colors?.divider,
    '--lt-progress-track': colors?.progressTrack,
    '--lt-progress-fill-default': colors?.progressFillDefault,
    '--lt-progress-fill-warning': colors?.progressFillWarning,
    '--lt-progress-fill-danger': colors?.progressFillDanger,
  });

  return (
    <div className="flex flex-col gap-6" style={cssVars}>
      {groups.map((group) => (
        <LimitGroupSection
          key={group.label}
          group={group}
          sectionClassName={sectionClassName}
          labelClassName={labelClassName}
          captionClassName={captionClassName}
          valueClassName={valueClassName}
          noteValueClassName={noteValueClassName}
          noteClassName={noteClassName}
        />
      ))}

      {footerNote != null && (
        <p
          className={mergeClasses(
            'm-0 border-t pt-4',
            footerClassName,
            styles.divider,
            styles.label,
          )}
        >
          {footerNote}
        </p>
      )}
    </div>
  );
};
