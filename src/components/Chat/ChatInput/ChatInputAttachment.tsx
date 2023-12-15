import {
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

interface Props {
  file: Pick<DialFile, 'name' | 'id' | 'status' | 'percent'>;

  onUnselectFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
}

export const ChatInputAttachment = ({
  file,
  onUnselectFile,
  onRetryFile,
}: Props) => {
  return (
    <div
      key={file.id}
      className="flex gap-3 rounded border border-gray-400 bg-gray-300 p-3 dark:border-gray-600 dark:bg-gray-900"
    >
      {file.status !== 'FAILED' ? (
        <IconFile className="shrink-0 text-gray-500" size={18} />
      ) : (
        <IconExclamationCircle
          className="shrink-0 text-red-800 dark:text-red-400"
          size={18}
        />
      )}

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden">
          <span
            className={classNames(
              'block max-w-full truncate',
              file.status === 'FAILED' && 'text-red-800 dark:text-red-400',
            )}
          >
            {file.name}
          </span>
          {file.status === 'UPLOADING' && (
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${file.percent}%` }}
              ></div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {file.status === 'FAILED' && (
            <button onClick={() => onRetryFile(file.id)}>
              <IconReload className="shrink-0 text-gray-500" size={18} />
            </button>
          )}
          <button onClick={() => onUnselectFile(file.id)}>
            <IconX
              className="shrink-0 text-gray-500 hover:text-blue-500"
              size={18}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
