import { DialFileName, Popup, NeutralButton } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, type FC, type ReactNode } from 'react';
import type { FileUploadBatchState } from '../upload-batch';

/** Props for the upload-progress modal. */
export interface UploadProgressModalProps {
  /** Current batch state with per-file entries and open flag. */
  batchState: FileUploadBatchState;
  /** Title shown in the modal header (e.g. "Uploading files"). */
  uploadProgressTitle: string;
  /** Summary text below the title (e.g. "3 of 5 uploaded"). */
  uploadProgressText: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  /** Called when the user clicks Cancel. */
  onCancel: () => void;
}

/** Modal showing per-file upload progress with a cancel action. */
export const UploadProgressModal: FC<UploadProgressModalProps> = ({
  batchState,
  uploadProgressTitle,
  uploadProgressText,
  cancelLabel,
  onCancel,
}) => {
  const { files } = batchState;

  const renderDetails = useCallback((percent?: number): ReactNode => {
    if (percent === undefined) {
      return null;
    }

    return (
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-control-disable-primary"
        data-qa="uploading-indicator"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-control-accent transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }, []);

  return (
    <Popup
      className="!h-fit !max-h-full !w-[400px] mobile:!w-full desktop:!max-h-[693px]"
      open={batchState.isOpen}
      closeOnOutsideClick={false}
      hideClose
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <NeutralButton label={cancelLabel} onClick={onCancel} />
        </div>
      }
      header={
        <div className="flex flex-col gap-2">
          <div>{uploadProgressTitle}</div>
          <div
            className="dial-small-text text-secondary"
            data-qa="uploading-items-count"
          >
            {uploadProgressText}
          </div>
        </div>
      }
    >
      <div className="flex h-full max-h-full flex-col gap-4 px-6">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {files.map((entry) => (
            <div key={entry.id} className="rounded bg-layer-sunken px-3 py-2">
              <DialFileName
                name={entry.name}
                details={renderDetails(entry.percent)}
              />
            </div>
          ))}
        </div>
      </div>
    </Popup>
  );
};

export default memo(UploadProgressModal);
