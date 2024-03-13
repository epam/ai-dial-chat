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

import { UploadStatus } from '@/src/types/common';
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

const cancelAllowedStatuses = new Set([
  UploadStatus.LOADING,
  UploadStatus.FAILED,
]);

export const FileItem = ({
  item,
  level,
  additionalItemData,
  onEvent,
}: Props) => {
  const { t } = useTranslation(Translation.Files);

  const [isContextMenu, setIsContextMenu] = useState(false);

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
    setIsContextMenu(false);
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
      className={classNames(
        'group/file-item flex justify-between gap-3 rounded px-3 py-1.5 hover:bg-accent-primary-alpha',
        isContextMenu && 'bg-accent-primary-alpha',
      )}
      style={{
        paddingLeft: `${1.005 + level * 1.5}rem`,
      }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="text-secondary">
          {!isSelected && item.status !== UploadStatus.FAILED ? (
            <IconFile
              className={classNames(
                item.status !== UploadStatus.LOADING &&
                  'group-hover/file-item:hidden',
              )}
              size={18}
            />
          ) : (
            item.status === UploadStatus.FAILED && (
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
          {item.status !== UploadStatus.LOADING &&
            item.status !== UploadStatus.FAILED && (
              <div
                className={classNames(
                  'relative size-[18px] group-hover/file-item:flex',
                  isSelected ? 'flex' : 'hidden',
                )}
              >
                <input
                  className="checkbox peer size-[18px] bg-layer-3"
                  type="checkbox"
                  checked={isSelected}
                  onChange={handleToggleFile}
                />
                <IconCheck
                  size={18}
                  className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                />
              </div>
            )}
        </div>
        <span
          className={classNames(
            'block max-w-full truncate whitespace-pre',
            item.status === UploadStatus.FAILED && 'text-error',
            isSelected && 'text-accent-primary',
          )}
        >
          {item.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {item.status === UploadStatus.LOADING && (
          <div className="h-[3px] w-[60px] overflow-hidden rounded-full bg-layer-3">
            <div
              className="h-full bg-controls-accent"
              style={{ width: `${item.percent}%` }}
            ></div>
          </div>
        )}
        {item.status === UploadStatus.FAILED && (
          <button onClick={handleRetry}>
            <IconReload
              className="shrink-0 text-secondary hover:text-accent-primary"
              size={18}
            />
          </button>
        )}
        {item.status && cancelAllowedStatuses.has(item.status) ? (
          <button onClick={handleCancelFile}>
            <IconX
              className="shrink-0 text-secondary hover:text-accent-primary"
              size={18}
            />
          </button>
        ) : (
          <FileItemContextMenu
            file={item}
            onDelete={handleRemove}
            onOpenChange={setIsContextMenu}
            className="invisible group-hover/file-item:visible"
          />
        )}
      </div>
    </div>
  );
};
