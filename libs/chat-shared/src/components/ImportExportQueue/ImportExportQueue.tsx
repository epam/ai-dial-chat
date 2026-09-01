import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  EllipsisTooltip,
  GhostIconButton,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertCircleFilled,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconX,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useId, useState, type FC } from 'react';
import {
  ConversationTransferJobStatus,
  type ConversationTransferJob,
} from '../../models/conversation-transfer';
import type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import { getTransferFileIcon } from '../../utils/transfer-file';
import { CircularProgress } from '../CircularProgress/CircularProgress';
import classes from './ImportExportQueue.module.scss';

export type {
  ImportExportQueueLabels,
  ImportExportQueueProps,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';

const AUTO_CLOSE_DELAY_MS = 8000;

/* Fixed footprint for every trailing status slot so switching between statuses never shifts layout. */
const STATUS_SLOT_CLASS = 'flex size-7 shrink-0 items-center justify-center';

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
  onCancel: (jobId: string) => void;
  styles?: ImportExportQueueStyles;
}

const JobRow: FC<JobRowProps> = ({ job, labels, onCancel, styles }) => {
  const typography = styles?.typography;
  const FileIcon = getTransferFileIcon(job.fileName);
  const isCanceled = job.status === ConversationTransferJobStatus.Canceled;
  const { units } = job.progress;

  return (
    <div className="group flex items-center gap-2 px-4 py-2">
      <FileIcon
        size={DIAL_ICON_SIZE.SM}
        stroke={DIAL_KIT_ICON_STROKE}
        className={classes.textSecondary}
        aria-hidden
      />
      <EllipsisTooltip
        text={job.fileName}
        className={mergeClasses(
          isCanceled ? classes.textSecondary : classes.text,
          typography?.jobLabelClassName || 'dial-small-text',
        )}
        contentClassName="!z-[80]"
      />
      {job.status === ConversationTransferJobStatus.InProgress && (
        /*
         * The ring and the cancel control share one grid cell so revealing one
         * and hiding the other shifts nothing. The button stays mounted and
         * focusable at all times — hiding it until hover would put cancel out
         * of reach of a keyboard.
         */
        <div className={mergeClasses(STATUS_SLOT_CLASS, 'grid')}>
          <span className="col-start-1 row-start-1 flex items-center justify-center opacity-100 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">
            <CircularProgress
              value={job.progress.percent}
              ariaLabel={labels.jobProgressAriaLabel(job.fileName)}
              ariaValueText={
                units ? labels.jobProgressValueText(units) : undefined
              }
              className={classes.progressRing}
            />
          </span>
          <GhostIconButton
            aria-label={labels.cancelJobAriaLabel(job.fileName)}
            size={ElementSize.Small}
            icon={
              <IconX
                size={DIAL_ICON_SIZE.SM}
                className={classes.textSecondary}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            onClick={() => onCancel(job.id)}
            className="col-start-1 row-start-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          />
        </div>
      )}
      {job.status === ConversationTransferJobStatus.Success && (
        <span className={STATUS_SLOT_CLASS}>
          <IconCheck
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            className={classes.successIcon}
            aria-hidden
          />
        </span>
      )}
      {job.status === ConversationTransferJobStatus.Failed && (
        <Tooltip
          tooltip={labels.jobErrorMessage(job.errorCode)}
          contentClassName="!z-[80]"
          asChild
        >
          {/*
           * The reason is the icon's accessible name, not only its tooltip:
           * a tooltip renders nothing on a mobile screen, so relying on it
           * alone would leave the failure unexplained there.
           */}
          <span
            className={STATUS_SLOT_CLASS}
            role="img"
            aria-label={labels.jobErrorMessage(job.errorCode)}
            tabIndex={0}
          >
            <IconAlertCircleFilled
              size={DIAL_ICON_SIZE.SM}
              className={classes.errorIcon}
              aria-hidden
            />
          </span>
        </Tooltip>
      )}
      {isCanceled && (
        <span
          className={mergeClasses(
            classes.textSecondary,
            'shrink-0',
            typography?.canceledLabelClassName || 'dial-small-text',
          )}
        >
          {labels.canceledLabel}
        </span>
      )}
    </div>
  );
};

/** Floating queue panel showing the status of in-flight or recently completed export/import jobs. */
export const ImportExportQueue: FC<ImportExportQueueProps> = memo(
  ({ title, jobs, onClose, onCancel, labels, styles }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const jobsId = useId();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const colors = styles?.colors;
    const typography = styles?.typography;
    const cssVars = {
      ...buildCssVars({
        '--ieq-bg': colors?.background,
        '--ieq-text': colors?.text,
        '--ieq-text-secondary': colors?.textSecondary,
        '--ieq-success-icon': colors?.successIcon,
        '--ieq-error-icon': colors?.errorIcon,
        '--ieq-progress-track': colors?.progressTrack,
        '--ieq-progress-indicator': colors?.progressIndicator,
        '--ieq-divider': colors?.divider,
        '--ieq-failure-count-bg': colors?.failureCountBackground,
        '--ieq-failure-count-text': colors?.failureCountText,
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
          'w-[370px] rounded-lg shadow-lg',
          styles?.rootClassName,
        )}
      >
        <div
          className={mergeClasses(
            classes.divider,
            'flex items-center justify-between px-4 py-3',
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={mergeClasses(
                classes.text,
                'truncate',
                typography?.titleClassName || 'dial-small-semi-text',
              )}
            >
              {title}
            </span>
            {failedCount > 0 && (
              <span
                className={mergeClasses(
                  classes.failureCount,
                  'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1',
                  typography?.failureCountClassName || 'dial-small-semi-text',
                )}
              >
                {failedCount}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <GhostIconButton
              aria-label={
                isCollapsed
                  ? labels.expandQueueAriaLabel
                  : labels.collapseQueueAriaLabel
              }
              size={ElementSize.Small}
              aria-expanded={!isCollapsed}
              aria-controls={jobsId}
              icon={
                isCollapsed ? (
                  <IconChevronUp
                    size={DIAL_ICON_SIZE.SM}
                    className={classes.textSecondary}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
                  />
                ) : (
                  <IconChevronDown
                    size={DIAL_ICON_SIZE.SM}
                    className={classes.textSecondary}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
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
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              }
              onClick={handleClose}
              className={STATUS_SLOT_CLASS}
            />
          </div>
        </div>
        {!isCollapsed && (
          <div
            id={jobsId}
            className={mergeClasses(
              'flex max-h-[40vh] flex-col overflow-y-auto py-1',
              styles?.bodyClassName,
            )}
          >
            {jobs.map((job) => (
              <JobRow
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
