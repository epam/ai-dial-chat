import {
  IconCheck,
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { FileItemContextMenu } from './FileItemContextMenu';

export enum FileItemEventIds {
  Cancel = 'cancel',
  Retry = 'retry',
  Toggle = 'toggle',
  Remove = 'remove',
}

interface Props {
  item: DialFile;
  level: number;

  onEvent?: (eventId: FileItemEventIds, data: string) => void;
}

const cancelAllowedStatuses = new Set(['UPLOADING', 'FAILED']);

export const FileItem = ({ item, level, onEvent }: Props) => {
  const selectedFilesIds = useAppSelector(
    FilesSelectors.selectSelectedFilesIds,
  );
  const [isSelected, setIsSelected] = useState(
    selectedFilesIds.includes(item.id),
  );
  const handleCancelFile = useCallback(() => {
    onEvent?.(FileItemEventIds.Cancel, item.id);
  }, [item.id, onEvent]);

  const handleToggleFile = useCallback(() => {
    setIsSelected((value) => !value);
    onEvent?.(FileItemEventIds.Toggle, item.id);
  }, [item.id, onEvent]);

  const handleRetry = useCallback(() => {
    onEvent?.(FileItemEventIds.Retry, item.id);
  }, [item.id, onEvent]);

  const handleRemove = useCallback(() => {
    onEvent?.(FileItemEventIds.Remove, item.id);
  }, [item.id, onEvent]);

  return (
    <div
      className="group/file-item flex justify-between gap-3 px-3 py-1.5"
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="group/file-icon text-gray-500">
          {!isSelected && item.status !== 'FAILED' ? (
            <IconFile className="group-hover/file-icon:hidden" size={18} />
          ) : (
            item.status === 'FAILED' && (
              <IconExclamationCircle
                className="shrink-0 text-red-800 dark:text-red-400"
                size={18}
              />
            )
          )}
          <div
            className={classNames(
              'relative h-[18px] w-[18px] group-hover/file-icon:flex',
              isSelected ? 'flex' : 'hidden',
            )}
          >
            <input
              className="checkbox-form peer h-[18px] w-[18px]"
              type="checkbox"
              checked={isSelected}
              onChange={handleToggleFile}
            />
            <IconCheck
              size={18}
              className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
            />
          </div>
        </div>
        <span
          className={classNames(
            'block max-w-full truncate',
            item.status === 'FAILED' && 'text-red-800 dark:text-red-400',
          )}
        >
          {item.name}
        </span>
      </div>

      <div className="flex items-center">
        {item.status === 'UPLOADING' && (
          <div className="h-[3px] w-[60px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${item.percent}%` }}
            ></div>
          </div>
        )}
        {item.status === 'FAILED' && (
          <button onClick={handleRetry}>
            <IconReload className="shrink-0 text-gray-500" size={18} />
          </button>
        )}
        {item.status && cancelAllowedStatuses.has(item.status) ? (
          <button onClick={handleCancelFile}>
            <IconX className="shrink-0 text-gray-500" size={18} />
          </button>
        ) : (
          <FileItemContextMenu
            file={item}
            onDelete={handleRemove}
            className="invisible group-hover/file-item:visible"
          />
        )}
      </div>
    </div>
  );
};
