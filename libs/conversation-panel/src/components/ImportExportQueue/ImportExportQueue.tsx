import {
  buildCssVars,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  mergeClasses,
  type ConversationTransferJob,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  EllipsisTooltip,
  ElementSize,
  GhostIconButton,
  ProgressBar,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertCircleFilled,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheckFilled,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useState, type FC } from 'react';
import type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';
import classes from './ImportExportQueue.module.scss';

export type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';

const AUTO_CLOSE_DELAY_MS = 8000;

/* Fixed footprint for every trailing status slot so switching between statuses never shifts layout. */
const STATUS_SLOT_CLASS = 'flex size-7 shrink-0 items-center justify-center';

const getJobLabel = (
  job: ConversationTransferJob,
  allConversationsJobLabel: string,
): string =>
  job.subject.kind === ConversationTransferSubjectKind.Single
    ? job.subject.title
    : allConversationsJobLabel;

const getJobDescription = (job: ConversationTransferJob): string | undefined =>
  job.subject.kind === ConversationTransferSubjectKind.Single
    ? job.subject.sourceBreadcrumb
    : undefined;

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

interface JobRowProps {
  job: ConversationTransferJob;
  labels: ImportExportQueueLabels;
  onDismiss: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  styles?: ImportExportQueueStyles;
}

const JobRow: FC<JobRowProps> = ({
  job,
  labels,
  onDismiss,
  onRetry,
  styles,
}) => {
  const label = getJobLabel(job, labels.allConversationsJobLabel);
  const description = getJobDescription(job);
  const typography = styles?.typography;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {description && (
          <EllipsisTooltip
            text={description}
            className={mergeClasses(
              classes.textSecondary,
              typography?.jobDescriptionClassName || 'dial-caption-text',
            )}
            contentClassName="!z-[80]"
          />
        )}
        <EllipsisTooltip
          text={label}
          className={mergeClasses(
            classes.text,
            typography?.jobLabelClassName || 'dial-small-text',
          )}
          contentClassName="!z-[80]"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {job.status === ConversationTransferJobStatus.Success && (
          <span className={STATUS_SLOT_CLASS}>
            <IconCircleCheckFilled size={16} className={classes.successIcon} />
          </span>
        )}
        {job.status === ConversationTransferJobStatus.Failed && (
          <>
            <GhostIconButton
              aria-label={labels.retryJobAriaLabel(label)}
              icon={
                <IconRefresh
                  size={DIAL_ICON_SIZE.SM}
                  className={classes.textSecondary}
                />
              }
              onClick={() => onRetry(job.id)}
            />
            <span className={STATUS_SLOT_CLASS}>
              <IconAlertCircleFilled size={16} className={classes.errorIcon} />
            </span>
          </>
        )}
        {job.status === ConversationTransferJobStatus.InProgress && (
          <GhostIconButton
            aria-label={labels.closeJobAriaLabel(label)}
            size={ElementSize.Small}
            icon={
              <IconX
                size={DIAL_ICON_SIZE.SM}
                className={classes.textSecondary}
              />
            }
            onClick={() => onDismiss(job.id)}
            className={STATUS_SLOT_CLASS}
          />
        )}
      </div>
    </div>
  );
};

/** Floating queue panel showing the status of in-flight or recently completed export/import jobs. */
export const ImportExportQueue: FC<ImportExportQueueProps> = memo(
  ({ title, jobs, onClose, onDismiss, onRetry, labels, styles }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const colors = styles?.colors;
    const typography = styles?.typography;
    const cssVars = {
      ...buildCssVars({
        '--cp-transfer-queue-bg': colors?.background,
        '--cp-transfer-queue-text': colors?.text,
        '--cp-transfer-queue-text-secondary': colors?.textSecondary,
        '--cp-transfer-queue-success-icon': colors?.successIcon,
        '--cp-transfer-queue-error-icon': colors?.errorIcon,
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
    const canAutoClose = jobs.length > 0 && !hasInProgress && !hasFailed;

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

    useEffect(() => {
      if (!canAutoClose) return undefined;

      const timeoutId = setTimeout(onClose, AUTO_CLOSE_DELAY_MS);
      return () => clearTimeout(timeoutId);
    }, [canAutoClose, onClose]);

    if (jobs.length === 0) return null;

    const finishedCount = jobs.filter(
      (job) => job.status !== ConversationTransferJobStatus.InProgress,
    ).length;
    const failedCount = jobs.filter(
      (job) => job.status === ConversationTransferJobStatus.Failed,
    ).length;
    const percentage = Math.round((finishedCount / jobs.length) * 100);

    return (
      <div
        role="status"
        aria-live="polite"
        style={cssVars}
        className={mergeClasses(
          classes.root,
          'w-[320px] rounded-lg shadow-lg',
          styles?.rootClassName,
        )}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className={mergeClasses(
                classes.text,
                typography?.titleClassName || 'dial-small-semi-text',
              )}
            >
              {title}
            </span>
            {failedCount > 0 && (
              <span
                className={mergeClasses(
                  classes.failureCount,
                  'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1',
                  typography?.failureCountClassName || 'dial-small-semi-text',
                )}
              >
                {failedCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <GhostIconButton
              aria-label={
                isCollapsed
                  ? labels.expandQueueAriaLabel
                  : labels.collapseQueueAriaLabel
              }
              size={ElementSize.Small}
              icon={
                isCollapsed ? (
                  <IconChevronUp
                    size={DIAL_ICON_SIZE.SM}
                    className={classes.textSecondary}
                  />
                ) : (
                  <IconChevronDown
                    size={DIAL_ICON_SIZE.SM}
                    className={classes.textSecondary}
                  />
                )
              }
              onClick={() => setIsCollapsed((value) => !value)}
              className={STATUS_SLOT_CLASS}
            />
            <GhostIconButton
              aria-label={labels.closeQueueAriaLabel}
              size={ElementSize.Small}
              icon={
                <IconX
                  size={DIAL_ICON_SIZE.SM}
                  className={classes.textSecondary}
                />
              }
              onClick={handleClose}
              className={STATUS_SLOT_CLASS}
            />
          </div>
        </div>
        <div className="px-3 pb-2">
          <ProgressBar
            value={percentage}
            size={ElementSize.Small}
            aria-label={title}
            className="w-full"
          />
        </div>
        {!isCollapsed && (
          <div
            className={mergeClasses(
              'flex max-h-[40vh] flex-col overflow-y-auto',
              styles?.bodyClassName,
            )}
          >
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                labels={labels}
                onDismiss={onDismiss}
                onRetry={onRetry}
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
