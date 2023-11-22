import {
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

interface Props {
  file: DialFile;
}

export const ChatInputAttachment = ({ file }: Props) => {
  const dispatch = useAppDispatch();
  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      return () => dispatch(FilesActions.unselectFiles({ ids: [fileId] }));
    },
    [dispatch],
  );

  const handleRetry = useCallback(
    (fileId: string) => {
      return () => dispatch(FilesActions.reuploadFile({ fileId }));
    },
    [dispatch],
  );

  if (!selectedFiles.length) {
    return null;
  }

  return (
    <div
      key={file.id}
      className="flex gap-3 rounded bg-gray-300 p-3 dark:bg-gray-900"
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
            <button onClick={handleRetry(file.id)}>
              <IconReload className="shrink-0 text-gray-500" size={18} />
            </button>
          )}
          <button onClick={handleUnselectFile(file.id)}>
            <IconX className="shrink-0 text-gray-500" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
