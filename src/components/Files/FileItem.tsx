import {
  IconCheck,
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
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
  additionalItemData?: Record<string, unknown>;

  onEvent?: (eventId: FileItemEventIds, data: string) => void;
}

const cancelAllowedStatuses = new Set(['UPLOADING', 'FAILED']);

export const FileItem = ({
  item,
  level,
  additionalItemData,
  onEvent,
}: Props) => {
  const { t } = useTranslation('files');

  const [isSelected, setIsSelected] = useState(false);
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

  useEffect(() => {
    setIsSelected(
      ((additionalItemData?.selectedFilesIds as string[]) || []).includes(
        item.id,
      ),
    );
  }, [additionalItemData?.selectedFilesIds, item.id]);

  return (
    <div
      className="group/file-item flex justify-between gap-3 rounded px-3 py-1.5 hover:bg-blue-500/20"
      style={{
        paddingLeft: `${1.005 + level * 1.5}rem`,
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="text-gray-500">
          {!isSelected && item.status !== 'FAILED' ? (
            <IconFile
              className={classNames(
                item.status !== 'UPLOADING' && 'group-hover/file-item:hidden',
              )}
              size={18}
            />
          ) : (
            item.status === 'FAILED' && (
              <Tooltip isTriggerClickable={true}>
                <TooltipTrigger>
                  <IconExclamationCircle
                    className="shrink-0 text-red-800 dark:text-red-400"
                    size={18}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {t('Uploading failed. Please, try again')}
                </TooltipContent>
              </Tooltip>
            )
          )}
          {item.status !== 'UPLOADING' && (
            <div
              className={classNames(
                'relative h-[18px] w-[18px] group-hover/file-item:flex',
                isSelected ? 'flex' : 'hidden',
              )}
            >
              <input
                className="checkbox peer h-[18px] w-[18px] bg-gray-100 dark:bg-gray-700"
                type="checkbox"
                checked={isSelected}
                onChange={handleToggleFile}
              />
              <IconCheck
                size={18}
                className="pointer-events-none invisible absolute text-blue-500 peer-checked:visible"
              />
            </div>
          )}
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

      <div className="flex items-center gap-2">
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
