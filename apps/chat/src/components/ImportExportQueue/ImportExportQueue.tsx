import {
  ButtonAppearance,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialIconButton,
  DialProgressBar,
  DialProgressBarSize,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertCircleFilled,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheckFilled,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { memo, useCallback, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
} from '../../constants/translation-keys';
import type { ExportJob } from '../../models/conversation-export';
import { ExportJobStatus } from '../../types/conversation-export';

interface Props {
  title: string;
  jobs: ExportJob[];
  onClose: () => void;
  onDismiss: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

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
  job: ExportJob;
  onDismiss: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

const JobRow: FC<JobRowProps> = ({ job, onDismiss, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="dial-small-text min-w-0 flex-1 truncate text-primary">
        {job.label}
      </span>
      {job.status === ExportJobStatus.Success && (
        <IconCircleCheckFilled
          size={16}
          className="shrink-0 text-accent-secondary"
        />
      )}
      {job.status === ExportJobStatus.Failed && (
        <>
          <DialIconButton
            aria-label={t(ConversationExportI18nKeys.RetryJobAriaLabel, {
              title: job.label,
            })}
            appearance={ButtonAppearance.Ghost}
            size={ElementSize.Small}
            icon={
              <IconRefresh
                size={DIAL_ICON_SIZE.SM}
                className="text-secondary"
              />
            }
            onClick={() => onRetry(job.id)}
            className="shrink-0"
          />
          <IconAlertCircleFilled size={16} className="shrink-0 text-error" />
        </>
      )}
      {job.status === ExportJobStatus.InProgress && (
        <DialIconButton
          aria-label={t(ConversationExportI18nKeys.CloseJobAriaLabel, {
            title: job.label,
          })}
          appearance={ButtonAppearance.Ghost}
          size={ElementSize.Small}
          icon={<IconX size={DIAL_ICON_SIZE.SM} className="text-secondary" />}
          onClick={() => onDismiss(job.id)}
          className="shrink-0"
        />
      )}
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
        job.status === ExportJobStatus.InProgress ||
        job.status === ExportJobStatus.Failed,
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

  if (jobs.length === 0) return null;

  const finishedCount = jobs.filter(
    (job) => job.status !== ExportJobStatus.InProgress,
  ).length;
  const failedCount = jobs.filter(
    (job) => job.status === ExportJobStatus.Failed,
  ).length;
  const percentage = Math.round((finishedCount / jobs.length) * 100);
  const hasInProgress = jobs.some(
    (job) => job.status === ExportJobStatus.InProgress,
  );
  const hasFailed = failedCount > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 end-4 z-[70] w-[320px] rounded-lg bg-layer-2 shadow-lg"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="dial-small-semi-text text-primary">{title}</span>
          {failedCount > 0 && (
            <span className="dial-small-semi-text inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-controls-error px-1 text-white">
              {failedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <DialIconButton
            aria-label={
              isCollapsed
                ? t(ConversationExportI18nKeys.ExpandQueueAriaLabel)
                : t(ConversationExportI18nKeys.CollapseQueueAriaLabel)
            }
            appearance={ButtonAppearance.Ghost}
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
          />
          <DialIconButton
            aria-label={t(ConversationExportI18nKeys.CloseQueueAriaLabel)}
            appearance={ButtonAppearance.Ghost}
            size={ElementSize.Small}
            icon={<IconX size={DIAL_ICON_SIZE.SM} className="text-secondary" />}
            onClick={handleClose}
          />
        </div>
      </div>
      <div className="px-3 pb-2">
        <DialProgressBar
          value={percentage}
          size={DialProgressBarSize.Small}
          ariaLabel={title}
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
      <DialConfirmationPopup
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
