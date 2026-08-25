import {
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
  type ConversationTransferJob,
} from '@epam/ai-dial-chat-hooks';
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
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
} from '../../constants/translation-keys';

/** Derives the job row's primary label text from its structured subject. */
const getJobLabel = (
  job: ConversationTransferJob,
  t: (key: ConversationExportI18nKeys) => string,
): string =>
  job.subject.kind === ConversationTransferSubjectKind.Single
    ? job.subject.title
    : t(ConversationExportI18nKeys.AllConversationsJobLabel);

/** Derives the job row's secondary breadcrumb line, if any. */
const getJobDescription = (job: ConversationTransferJob): string | undefined =>
  job.subject.kind === ConversationTransferSubjectKind.Single
    ? job.subject.sourceBreadcrumb
    : undefined;

interface Props {
  title: string;
  jobs: ConversationTransferJob[];
  onClose: () => void;
  onDismiss: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

const AUTO_CLOSE_DELAY_MS = 8000;

const getCloseConfirmDescriptionKey = (
  hasInProgress: boolean,
  hasFailed: boolean,
): ConversationExportI18nKeys => {
  if (hasInProgress && hasFailed) {
    return ConversationExportI18nKeys.CloseQueueConfirmDescriptionMixed;
  }
  if (hasFailed) {
    return ConversationExportI18nKeys.CloseQueueConfirmDescriptionFailed;
  }
  return ConversationExportI18nKeys.CloseQueueConfirmDescriptionInProgress;
};

interface JobRowProps {
  job: ConversationTransferJob;
  onDismiss: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

/*
 * Fixed footprint for every trailing status slot (close/retry buttons and the
 * plain success/failed icons) so switching between them on status change
 * (e.g. in-progress → success) never shifts the row's width/layout.
 */
const STATUS_SLOT_CLASS = 'flex size-7 shrink-0 items-center justify-center';

const JobRow: FC<JobRowProps> = ({ job, onDismiss, onRetry }) => {
  const { t } = useTranslation();
  const label = getJobLabel(job, t);
  const description = getJobDescription(job);

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        {description && (
          <EllipsisTooltip
            text={description}
            className="dial-caption-text text-secondary"
            contentClassName="!z-[80]"
          />
        )}
        <EllipsisTooltip
          text={label}
          className="dial-small-text text-primary"
          contentClassName="!z-[80]"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {job.status === ConversationTransferJobStatus.Success && (
          <span className={STATUS_SLOT_CLASS}>
            <IconCircleCheckFilled
              size={16}
              className="text-accent-secondary"
            />
          </span>
        )}
        {job.status === ConversationTransferJobStatus.Failed && (
          <>
            <GhostIconButton
              aria-label={t(ConversationExportI18nKeys.RetryJobAriaLabel, {
                title: label,
              })}
              icon={
                <IconRefresh
                  size={DIAL_ICON_SIZE.SM}
                  className="text-secondary"
                />
              }
              onClick={() => onRetry(job.id)}
            />
            <span className={STATUS_SLOT_CLASS}>
              <IconAlertCircleFilled size={16} className="text-error" />
            </span>
          </>
        )}
        {job.status === ConversationTransferJobStatus.InProgress && (
          <GhostIconButton
            aria-label={t(ConversationExportI18nKeys.CloseJobAriaLabel, {
              title: label,
            })}
            size={ElementSize.Small}
            icon={<IconX size={DIAL_ICON_SIZE.SM} className="text-secondary" />}
            onClick={() => onDismiss(job.id)}
            className={STATUS_SLOT_CLASS}
          />
        )}
      </div>
    </div>
  );
};

const ImportExportQueue: FC<Props> = ({
  title,
  jobs,
  onClose,
  onDismiss,
  onRetry,
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleClose = useCallback(() => {
    const hasActiveJobs = jobs.some(
      (job) =>
        job.status === ConversationTransferJobStatus.InProgress ||
        job.status === ConversationTransferJobStatus.Failed,
    );
    if (hasActiveJobs) {
      setIsConfirmOpen(true);
    } else {
      onClose();
    }
  }, [jobs, onClose]);

  const handleConfirmClose = useCallback(() => {
    setIsConfirmOpen(false);
    onClose();
  }, [onClose]);

  const hasInProgress = jobs.some(
    (job) => job.status === ConversationTransferJobStatus.InProgress,
  );
  const hasFailed = jobs.some(
    (job) => job.status === ConversationTransferJobStatus.Failed,
  );
  const canAutoClose = jobs.length > 0 && !hasInProgress && !hasFailed;

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
      className="w-[320px] rounded-lg bg-layer-base shadow-lg"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="dial-small-semi-text text-primary">{title}</span>
          {failedCount > 0 && (
            <span className="dial-small-semi-text inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-control-error px-1 text-tertiary">
              {failedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <GhostIconButton
            aria-label={
              isCollapsed
                ? t(ConversationExportI18nKeys.ExpandQueueAriaLabel)
                : t(ConversationExportI18nKeys.CollapseQueueAriaLabel)
            }
            size={ElementSize.Small}
            icon={
              isCollapsed ? (
                <IconChevronUp
                  size={DIAL_ICON_SIZE.SM}
                  className="text-secondary"
                />
              ) : (
                <IconChevronDown
                  size={DIAL_ICON_SIZE.SM}
                  className="text-secondary"
                />
              )
            }
            onClick={() => setIsCollapsed((value) => !value)}
            className={STATUS_SLOT_CLASS}
          />
          <GhostIconButton
            aria-label={t(ConversationExportI18nKeys.CloseQueueAriaLabel)}
            size={ElementSize.Small}
            icon={<IconX size={DIAL_ICON_SIZE.SM} />}
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
        <div className="flex max-h-[40vh] flex-col overflow-y-auto">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onDismiss={onDismiss}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
      <ConfirmationPopup
        open={isConfirmOpen}
        header={t(ConversationExportI18nKeys.CloseQueueConfirmHeader)}
        description={t(getCloseConfirmDescriptionKey(hasInProgress, hasFailed))}
        confirmLabel={t(ButtonsI18nKeys.Close)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={handleConfirmClose}
        onClose={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};

export default memo(ImportExportQueue);
