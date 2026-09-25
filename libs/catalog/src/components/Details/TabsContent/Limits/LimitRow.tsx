import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { UsageLimitProgressRow } from '../../../../models/item-details-data';
import type { LimitRowClassNames } from '../../../../models/limits-props';
import { LimitRowLayout } from '../../../../types/limit-row-layout';
import {
  getProgressMax,
  getProgressStatus,
  getProgressValue,
  getValueLabel,
  isCapped,
  ProgressStatus,
} from '../../../../utils/usage-limits';
import styles from './Limits.module.scss';

interface LimitRowProps extends LimitRowClassNames {
  row: UsageLimitProgressRow;
  layout: LimitRowLayout;
}

/** A single usage-limit line, arranged per `layout`: either a label column beside a fixed-width value/progress column, or a label/value line above a full-width bar. */
export const LimitRow: FC<LimitRowProps> = ({
  row,
  layout,
  labelClassName,
  captionClassName,
  valueClassName,
  noteValueClassName,
  noteClassName,
}) => {
  const valueLabel = getValueLabel(row);
  const progressStatus = getProgressStatus(row);

  const progressBar = (
    <ProgressBar
      value={getProgressValue(row)}
      max={getProgressMax(row.total)}
      size={ElementSize.Small}
      className={mergeClasses(
        '!h-1 w-full',
        styles.progressTrack,
        progressStatus === ProgressStatus.Default && styles.progressFillDefault,
        progressStatus === ProgressStatus.Warning && styles.progressFillWarning,
        progressStatus === ProgressStatus.Danger && styles.progressFillDanger,
      )}
      aria-label={row.label}
      aria-valuetext={row.ariaLabel ?? valueLabel}
    />
  );

  const caption = row.captionLabel != null && (
    <span
      className={mergeClasses('break-words', captionClassName, styles.label)}
    >
      {row.captionLabel}
    </span>
  );

  /* Rendered for an unlimited row too — an unconfigured limit still
     accumulates against a period that rolls over. */
  const resetLine = row.resetLabel != null && (
    <>
      {/* `aria-label` is not reliably supported on a bare `<time>`, so the
          spoken form — which names the timezone in full rather than as an
          offset — is carried by a visually-hidden sibling instead. */}
      <time
        dateTime={row.resetIsoValue}
        aria-hidden={row.resetAriaLabel != null || undefined}
        className={mergeClasses(
          'break-words',
          captionClassName,
          styles.resetLabel,
        )}
      >
        {row.resetLabel}
      </time>
      {row.resetAriaLabel != null && (
        <span className="sr-only">{row.resetAriaLabel}</span>
      )}
    </>
  );

  if (layout === LimitRowLayout.Stacked) {
    return (
      <li
        className={mergeClasses(
          'flex flex-col gap-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0',
          styles.divider,
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={mergeClasses(
              'min-w-0 break-words',
              labelClassName,
              styles.valuePrimary,
            )}
          >
            {row.label}
          </span>
          <span
            className={mergeClasses(
              'shrink-0',
              valueClassName,
              progressStatus === ProgressStatus.Danger
                ? styles.valueDanger
                : styles.valuePrimary,
            )}
          >
            {valueLabel}
          </span>
        </div>

        {caption}

        {isCapped(row)
          ? progressBar
          : row.noteLabel != null && (
              <span className={mergeClasses(noteClassName, styles.label)}>
                {row.noteLabel}
              </span>
            )}

        {resetLine}
      </li>
    );
  }

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
        {caption}
        {resetLine}
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
          {progressBar}
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
