import {
  IconCheck,
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import { MouseEventHandler, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from '../Common/ConfirmDialog';
import ShareIcon from '../Common/ShareIcon';
import Tooltip from '../Common/Tooltip';
import { FileItemContextMenu } from './FileItemContextMenu';

import { UploadStatus } from '@epam/ai-dial-shared';

export enum FileItemEventIds {
  Cancel = 'cancel',
  Retry = 'retry',
  Toggle = 'toggle',
  ToggleFolder = 'toggleFolder',
  Delete = 'delete',
}

interface Props {
  item: DialFile;
  level: number;
  additionalItemData?: AdditionalItemData;
  iconClassNames?: string;
  wrapperClassNames?: string;
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
  iconClassNames,
  wrapperClassNames,
  onEvent,
}: Props) => {
  const { t } = useTranslation(Translation.Files);

  const dispatch = useAppDispatch();

  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const canAttachFiles = !!additionalItemData?.canAttachFiles;

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

  const handleDelete = useCallback(() => {
    setIsContextMenu(false);
    onEvent?.(FileItemEventIds.Delete, item.id);
  }, [item.id, onEvent]);

  const handleUnshare: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsUnshareConfirmOpened(true);
      setIsContextMenu(false);
    }, []);

  const handleOpenUnpublishing: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsContextMenu(false);
    }, []);

  useEffect(() => {
    setIsSelected(
      (additionalItemData?.selectedFilesIds ?? []).includes(item.id) ||
        (additionalItemData?.selectedFolderIds ?? []).some((folderId) =>
          item.id.startsWith(folderId),
        ),
    );

    setIsHighlighted(
      (additionalItemData?.selectedFilesIds ?? []).includes(item.id),
    );
  }, [
    additionalItemData?.selectedFilesIds,
    additionalItemData?.selectedFolderIds,
    item.id,
  ]);

  return (
    <div
      className={classNames(
        'group/file-item flex justify-between gap-3 rounded px-3 py-1.5 hover:bg-accent-primary-alpha',
        (isHighlighted || isContextMenu) && 'bg-accent-primary-alpha',
        wrapperClassNames,
      )}
      style={{
        paddingLeft: `${1.005 + level * 1.5}rem`,
      }}
      data-qa="file"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="text-secondary" data-qa="attached-file-icon">
          {(!canAttachFiles || !isSelected) &&
          item.status !== UploadStatus.FAILED ? (
            <ShareIcon
              {...item}
              containerClassName={classNames(
                item.status !== UploadStatus.LOADING &&
                  canAttachFiles &&
                  'group-hover/file-item:hidden',
              )}
              featureType={FeatureType.Chat}
              isHighlighted={isSelected}
            >
              <IconFile
                className={classNames(
                  item.status !== UploadStatus.LOADING &&
                    canAttachFiles &&
                    'text-secondary group-hover/file-item:hidden',
                  iconClassNames,
                )}
                size={18}
              />
            </ShareIcon>
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
            item.status !== UploadStatus.FAILED &&
            canAttachFiles && (
              <div
                className={classNames(
                  'relative size-[18px] group-hover/file-item:flex',
                  isSelected ? 'flex' : 'hidden',
                )}
                data-qa={isSelected ? 'selected' : null}
              >
                <input
                  className="checkbox peer size-[18px] bg-layer-3"
                  type="checkbox"
                  checked={isSelected}
                  data-qa={isSelected ? 'checked' : 'unchecked'}
                  onChange={handleToggleFile}
                />
                <IconCheck
                  size={18}
                  className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                />
              </div>
            )}
        </div>
        <Tooltip
          tooltip={item.name}
          triggerClassName="block max-h-5 flex-1 truncate whitespace-pre text-left"
          contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
        >
          <span
            className={classNames(
              'block max-w-full truncate whitespace-pre',
              item.status === UploadStatus.FAILED && 'text-error',
              isSelected && 'text-accent-primary',
            )}
            data-qa="entity-name"
          >
            {item.name}
          </span>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        {item.status === UploadStatus.LOADING && (
          <div className="h-[3px] w-[60px] overflow-hidden rounded-full bg-layer-3">
            <div
              className="h-full bg-controls-accent"
              style={{ width: `${item.percent}%` }}
              data-qa="attachment-loading"
            ></div>
          </div>
        )}
        {item.status === UploadStatus.FAILED && (
          <button onClick={handleRetry} data-qa="retry-upload">
            <IconReload
              className="shrink-0 text-secondary hover:text-accent-primary"
              size={18}
            />
          </button>
        )}
        {item.status && cancelAllowedStatuses.has(item.status) ? (
          <button onClick={handleCancelFile} data-qa="remove-file">
            <IconX
              className="shrink-0 text-secondary hover:text-accent-primary"
              size={18}
            />
          </button>
        ) : (
          <FileItemContextMenu
            file={item}
            onDelete={handleDelete}
            onOpenChange={setIsContextMenu}
            onUnshare={handleUnshare}
            onUnpublish={handleOpenUnpublishing}
            className="invisible group-hover/file-item:visible"
          />
        )}
      </div>
      {isUnshareConfirmOpened && (
        <ConfirmDialog
          isOpen={isUnshareConfirmOpened}
          heading={t('Confirm unsharing: {{fileName}}', {
            fileName: item.name,
          })}
          description={
            t('Are you sure that you want to unshare this file?') || ''
          }
          confirmLabel={t('Unshare')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsUnshareConfirmOpened(false);
            if (result) {
              dispatch(
                ShareActions.revokeAccess({
                  resourceId: item.id,
                  featureType: FeatureType.File,
                }),
              );
            }
          }}
        />
      )}
    </div>
  );
};
