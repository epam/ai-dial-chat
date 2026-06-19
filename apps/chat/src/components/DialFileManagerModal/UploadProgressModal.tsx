import {
  DialGhostButton,
  DialPopup,
  DialPrimaryButton,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import type { FileUploadBatchState } from './types/upload';
import { FileUploadStatus } from './types/upload';

interface Props {
  batchState: FileUploadBatchState;
  uploadProgressTitle: string;
  queuedLabel: string;
  uploadingLabel: string;
  completeLabel: string;
  failedLabel: string;
  cancelledLabel: string;
  cancelAllLabel: string;
  doneLabel: string;
  onCancelAll: () => void;
  onDone: () => void;
}

const STATUS_CLASS: Record<FileUploadStatus, string> = {
  [FileUploadStatus.Queued]: 'text-secondary-bg-accent',
  [FileUploadStatus.Uploading]: 'text-accent',
  [FileUploadStatus.Completed]: 'text-success',
  [FileUploadStatus.Failed]: 'text-error',
  [FileUploadStatus.Cancelled]: 'text-secondary',
};

const UploadProgressModal: FC<Props> = ({
  batchState,
  uploadProgressTitle,
  queuedLabel,
  uploadingLabel,
  completeLabel,
  failedLabel,
  cancelledLabel,
  cancelAllLabel,
  doneLabel,
  onCancelAll,
  onDone,
}) => {
  const { files } = batchState;

  const isActive = files.some(
    (f) =>
      f.status === FileUploadStatus.Queued ||
      f.status === FileUploadStatus.Uploading,
  );

  const statusLabel: Record<FileUploadStatus, string> = {
    [FileUploadStatus.Queued]: queuedLabel,
    [FileUploadStatus.Uploading]: uploadingLabel,
    [FileUploadStatus.Completed]: completeLabel,
    [FileUploadStatus.Failed]: failedLabel,
    [FileUploadStatus.Cancelled]: cancelledLabel,
  };

  return (
    <DialPopup
      open={batchState.isOpen}
      header={uploadProgressTitle}
      size={PopupSize.Md}
      closeOnOutsideClick={false}
      hideClose={isActive}
      onClose={onDone}
      footer={
        <div className="flex justify-end px-6 py-4">
          {isActive ? (
            <DialGhostButton label={cancelAllLabel} onClick={onCancelAll} />
          ) : (
            <DialPrimaryButton label={doneLabel} onClick={onDone} />
          )}
        </div>
      }
    >
      <ul
        role="log"
        aria-live="polite"
        aria-label={uploadProgressTitle}
        className="flex flex-col gap-1 overflow-y-auto px-6 py-4"
      >
        {files.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-2 py-1"
            role={
              entry.status === FileUploadStatus.Failed ? 'alert' : undefined
            }
          >
            <span className="min-w-0 flex-1 truncate text-sm text-primary">
              {entry.name}
            </span>
            <span
              className={`shrink-0 text-xs font-medium ${STATUS_CLASS[entry.status]}`}
            >
              {statusLabel[entry.status]}
            </span>
          </li>
        ))}
      </ul>
    </DialPopup>
  );
};

export default memo(UploadProgressModal);
