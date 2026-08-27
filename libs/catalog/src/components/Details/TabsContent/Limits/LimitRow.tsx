import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { UsageLimitProgressRow } from '../../../../models/item-details-data';
import type { LimitRowClassNames } from './limits-props';
import {
  getProgressMax,
  getProgressStatus,
  getProgressValue,
  getValueLabel,
  isCapped,
  ProgressStatus,
} from './limits-utils';
import styles from './Limits.module.scss';

interface LimitRowProps extends LimitRowClassNames {
  row: UsageLimitProgressRow;
}

/** A single usage-limit line: label (plus optional caption) on one side, a capped progress bar or a plain value on the other. */
export const LimitRow: FC<LimitRowProps> = ({
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
