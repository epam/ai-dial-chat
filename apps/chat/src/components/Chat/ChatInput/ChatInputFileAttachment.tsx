import {
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { UploadStatus } from '@/src/types/common';
import { DialFile } from '@/src/types/files';

interface Props {
  file: Pick<DialFile, 'name' | 'id' | 'status' | 'percent'>;

  onUnselectFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;
}

export const ChatInputFileAttachment = ({
  file,
  onUnselectFile,
  onRetryFile,
}: Props) => {
  return (
    <div
      key={file.id}
      className="flex items-center gap-3 rounded border border-primary bg-layer-1 px-3 py-2"
      data-qa="chat-attachment"
    >
      {file.status !== UploadStatus.FAILED ? (
        <IconFile className="shrink-0 text-secondary-bg-light" size={18} />
      ) : (
        <IconExclamationCircle
          className="shrink-0 text-accent-primary"
          size={18}
        />
      )}

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden text-sm">
          <span
            className={classNames(
              'block max-w-full truncate whitespace-pre text-start text-sm',
            )}
            data-qa="attachment-name"
          >
            {file.name}
          </span>
          {file.status === UploadStatus.LOADING && (
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-layer-3">
              <div
                className="h-full bg-controls-accent"
                style={{ width: `${file.percent}%` }}
                data-qa="attachment-loading"
              ></div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {onRetryFile && file.status === UploadStatus.FAILED && (
            <button data-qa="retry-upload" onClick={() => onRetryFile(file.id)}>
              <IconReload
                className="shrink-0 text-tertiary-bg-light hover:text-primary-bg-light"
                size={18}
              />
            </button>
          )}
          {onUnselectFile && (
            <button
              onClick={() => onUnselectFile(file.id)}
              data-qa="remove-file"
            >
              <IconX
                className="shrink-0 text-tertiary-bg-light hover:text-primary-bg-light"
                size={18}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
