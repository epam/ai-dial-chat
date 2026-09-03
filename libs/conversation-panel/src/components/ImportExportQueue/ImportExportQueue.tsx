import {
  buildCssVars,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  ElementSize,
  ProgressBar,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useId, useState, type FC } from 'react';
import { AUTO_CLOSE_DELAY_MS } from '../../constants/import-export-queue';
import type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
} from '../../models/import-export-queue';
import { ImportExportQueueHeader } from '../ImportExportQueueHeader/ImportExportQueueHeader';
import { ImportExportQueueRow } from '../ImportExportQueueRow/ImportExportQueueRow';
import classes from './ImportExportQueue.module.scss';

export type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';

/**
 * Mean completion across every job, terminal ones included at their settled
 * percent. Unweighted on purpose: neither conversation counts nor byte sizes
 * are known when the queue is built, so a weighted value would jump as
 * discovery refined the weights, and each job's own percent is already
 * phase-weighted internally.
 */
const getAggregatePercent = (jobs: ConversationTransferJob[]): number =>
  Math.round(
    jobs.reduce((total, job) => total + job.progress.percent, 0) / jobs.length,
  );

/** How many jobs have reached any terminal status. */
const getSettledCount = (jobs: ConversationTransferJob[]): number =>
  jobs.filter((job) => job.status !== ConversationTransferJobStatus.InProgress)
    .length;

const getCloseConfirmDescription = (
  hasInProgress: boolean,
  hasFailed: boolean,
  labels: ImportExportQueueLabels,
): string => {
  if (hasInProgress && hasFailed) {
    return labels.closeQueueConfirmDescriptionMixed;
  }
  if (hasFailed) {
    return labels.closeQueueConfirmDescriptionFailed;
  }
  return labels.closeQueueConfirmDescriptionInProgress;
};

/** Floating queue panel showing the status of in-flight or recently completed export/import jobs. */
export const ImportExportQueue: FC<ImportExportQueueProps> = memo(
  ({ title, jobs, onClose, onCancel, labels, styles }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const jobsId = useId();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const colors = styles?.colors;
    const cssVars = {
      ...buildCssVars({
        '--cp-transfer-queue-bg': colors?.background,
        '--cp-transfer-queue-text': colors?.text,
        '--cp-transfer-queue-text-secondary': colors?.textSecondary,
        '--cp-transfer-queue-success-icon': colors?.successIcon,
        '--cp-transfer-queue-error-icon': colors?.errorIcon,
        '--cp-transfer-queue-warning-icon': colors?.warningIcon,
        '--cp-transfer-queue-divider': colors?.divider,
        '--cp-transfer-queue-failure-count-bg': colors?.failureCountBackground,
        '--cp-transfer-queue-failure-count-text': colors?.failureCountText,
      }),
      ...styles?.cssVars,
    };

    const hasInProgress = jobs.some(
      (job) => job.status === ConversationTransferJobStatus.InProgress,
    );
    const hasFailed = jobs.some(
      (job) => job.status === ConversationTransferJobStatus.Failed,
    );
    const isEverySucceeded =
      jobs.length > 0 &&
      jobs.every((job) => job.status === ConversationTransferJobStatus.Success);

    const handleClose = useCallback(() => {
      if (hasInProgress || hasFailed) {
        setIsConfirmOpen(true);
      } else {
        onClose();
      }
    }, [hasInProgress, hasFailed, onClose]);

    const handleConfirmClose = useCallback(() => {
      setIsConfirmOpen(false);
      onClose();
    }, [onClose]);

    const handleToggleCollapse = useCallback(() => {
      setIsCollapsed((value) => !value);
    }, []);

    useEffect(() => {
      if (!isEverySucceeded) return undefined;

      const timeoutId = setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
      return () => clearTimeout(timeoutId);
    }, [isEverySucceeded, onClose]);

    if (jobs.length === 0) return null;

    const failedCount = jobs.filter(
      (job) => job.status === ConversationTransferJobStatus.Failed,
    ).length;

    return (
      <div
        role="status"
        aria-live="polite"
        style={cssVars}
        className={mergeClasses(
          classes.root,
          'w-[370px] max-w-[calc(100vw-2rem)] rounded-xl shadow-md',
          styles?.rootClassName,
        )}
      >
        <ImportExportQueueHeader
          title={title}
          failedCount={failedCount}
          isCollapsed={isCollapsed}
          jobsId={jobsId}
          labels={labels}
          styles={styles}
          onToggleCollapse={handleToggleCollapse}
          onClose={handleClose}
        />
        {isCollapsed && hasInProgress && (
          /*
           * Only while collapsed: expanded, every row already carries its own
           * spinner, so an aggregate bar would restate what is on screen.
           * Collapsed, the rows are unmounted and nothing else says work
           * continues.
           */
          <ProgressBar
            value={getAggregatePercent(jobs)}
            size={ElementSize.Small}
            aria-label={labels.queueProgressAriaLabel}
            aria-valuetext={labels.queueProgressValueText(
              getSettledCount(jobs),
              jobs.length,
            )}
          />
        )}
        {!isCollapsed && (
          <div
            id={jobsId}
            className={mergeClasses(
              'flex max-h-[40vh] flex-col overflow-y-auto py-1',
              styles?.bodyClassName,
            )}
          >
            {jobs.map((job) => (
              <ImportExportQueueRow
                key={job.id}
                job={job}
                labels={labels}
                onCancel={onCancel}
                styles={styles}
              />
            ))}
          </div>
        )}
        <ConfirmationPopup
          open={isConfirmOpen}
          header={labels.closeQueueConfirmHeader}
          description={getCloseConfirmDescription(
            hasInProgress,
            hasFailed,
            labels,
          )}
          confirmLabel={labels.closeLabel}
          cancelLabel={labels.cancelLabel}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={handleConfirmClose}
          onClose={() => setIsConfirmOpen(false)}
        />
      </div>
    );
  },
);

ImportExportQueue.displayName = 'ImportExportQueue';
