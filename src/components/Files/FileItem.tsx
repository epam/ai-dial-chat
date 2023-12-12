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
import { Translation } from '@/src/types/translation';

import Tooltip from '../Common/Tooltip';
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
  const { t } = useTranslation(Translation.Files);

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
      className="group/file-item hover:bg-blue-500/20 flex justify-between gap-3 rounded px-3 py-1.5"
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
              <Tooltip
                isTriggerClickable
                tooltip={t('Uploading failed. Please, try again')}
              >
                <IconExclamationCircle
                  className="shrink-0 text-error"
                  size={18}
                />
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
                className="checkbox bg-gray-100 peer h-[18px] w-[18px]"
                type="checkbox"
                checked={isSelected}
                onChange={handleToggleFile}
              />
              <IconCheck
                size={18}
                className="text-blue-500 pointer-events-none invisible absolute peer-checked:visible"
              />
            </div>
          )}
        </div>
        <span
          className={classNames(
            'block max-w-full truncate',
            item.status === 'FAILED' && 'text-error',
          )}
        >
          {item.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {item.status === 'UPLOADING' && (
          <div className="bg-gray-100 h-[3px] w-[60px] overflow-hidden rounded-full">
            <div
              className="bg-blue-500 h-full"
              style={{ width: `${item.percent}%` }}
            ></div>
          </div>
        )}
        {item.status === 'FAILED' && (
          <button onClick={handleRetry}>
            <IconReload className="text-gray-500 shrink-0" size={18} />
          </button>
        )}
        {item.status && cancelAllowedStatuses.has(item.status) ? (
          <button onClick={handleCancelFile}>
            <IconX className="text-gray-500 shrink-0" size={18} />
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
