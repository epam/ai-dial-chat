import { DialFileName, DialPopup, NeutralButton } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, type FC, type ReactNode } from 'react';
import type { FileUploadBatchState } from './types/upload';

interface Props {
  batchState: FileUploadBatchState;
  uploadProgressTitle: string;
  uploadProgressText: string;
  cancelLabel: string;
  onCancel: () => void;
}

const UploadProgressModal: FC<Props> = ({
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
        className="h-1 w-full overflow-hidden rounded-full bg-layer-1"
        data-qa="uploading-indicator"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="bg-accent-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }, []);

  return (
    <DialPopup
      className="!h-fit !max-h-full !w-[400px] desktop:!max-h-[693px]"
      open={batchState.isOpen}
      dividers={false}
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
            className="text-sm text-secondary"
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
    </DialPopup>
  );
};

export default memo(UploadProgressModal);
