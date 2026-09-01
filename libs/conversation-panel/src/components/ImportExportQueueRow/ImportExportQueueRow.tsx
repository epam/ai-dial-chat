import {
  ConversationTransferJobStatus,
  mergeClasses,
  type ConversationTransferJob,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  EllipsisTooltip,
  GhostIconButton,
  Spinner,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconAlertCircleFilled, IconCheck, IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import { STATUS_SLOT_CLASS } from '../../constants/import-export-queue';
import type {
  ImportExportQueueLabels,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';
import { getTransferFileIcon } from '../../utils/transfer-file';
import classes from '../ImportExportQueue/ImportExportQueue.module.scss';

/** Props for `ImportExportQueueRow`. */
export interface ImportExportQueueRowProps {
  /** The transfer job this row represents. */
  job: ConversationTransferJob;
  /** User-visible string labels, supplied by the host. */
  labels: ImportExportQueueLabels;
  /** Called with the job id when the user cancels an in-progress job. */
  onCancel: (jobId: string) => void;
  /** Color, typography, class, and CSS-variable overrides. */
  styles?: ImportExportQueueStyles;
}

/** One queue row: the transferred file's icon and name, plus a trailing status slot. */
export const ImportExportQueueRow: FC<ImportExportQueueRowProps> = ({
  job,
  labels,
  onCancel,
  styles,
}) => {
  const typography = styles?.typography;
  const FileIcon = getTransferFileIcon(job.fileName);
  const isCanceled = job.status === ConversationTransferJobStatus.Canceled;

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
         * The spinner and the cancel control share one grid cell so revealing
         * one and hiding the other shifts nothing. The button stays mounted and
         * focusable at all times — hiding it until hover would put cancel out
         * of reach of a keyboard.
         */
        <div className={mergeClasses(STATUS_SLOT_CLASS, 'grid')}>
          <Spinner
            size={DIAL_ICON_SIZE.SM}
            ariaLabel={labels.jobProgressAriaLabel(job.fileName)}
            className="col-start-1 row-start-1 opacity-100 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0"
          />
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
