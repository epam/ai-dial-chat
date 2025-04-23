import {
  IconCheck,
  IconExclamationCircle,
  IconFile,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import {
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useContextMenuTrigger } from '@/src/hooks/useContextMenuTrigger';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isTabletScreen } from '@/src/utils/app/mobile';

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
  Unshare = 'unshare',
}

interface Props {
  item: DialFile;
  level: number;
  additionalItemData?: AdditionalItemData;
  iconClassNames?: string;
  wrapperClassNames?: string;
  onEvent?: (eventId: FileItemEventIds, data: string) => void;
  onSave?: (fileId: string) => void;
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
  onSave,
}: Props) => {
  const { t } = useTranslation(Translation.Files);

  const dispatch = useAppDispatch();

  const [isContextMenu, setIsContextMenu] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isRemoveAccessConfirmOpened, setIsRemoveAccessConfirmOpened] =
    useState(false);

  const fileRef = useRef<HTMLDivElement>(null);

  const canAttachFiles = !!additionalItemData?.canAttachFiles;

  const handleContextMenuOpen = useCallback(() => {
    setIsContextMenu(true);
  }, []);

  useContextMenuTrigger(handleContextMenuOpen, fileRef);

  const handleCancelFile = useCallback(() => {
    onEvent?.(FileItemEventIds.Cancel, item.id);
  }, [item.id, onEvent]);

  const handleToggleFile = useCallback(() => {
    if (!canAttachFiles) {
      return;
    }

    setIsSelected((value) => !value);
    onEvent?.(FileItemEventIds.Toggle, item.id);
  }, [canAttachFiles, item.id, onEvent]);

  const handleRetry = useCallback(() => {
    onEvent?.(FileItemEventIds.Retry, item.id);
  }, [item.id, onEvent]);

  const handleDelete = useCallback(() => {
    setIsContextMenu(false);
    onEvent?.(FileItemEventIds.Delete, item.id);
  }, [item.id, onEvent]);

  const handleUnshare = useCallback(() => {
    setIsContextMenu(false);
    onEvent?.(FileItemEventIds.Unshare, item.id);
  }, [item.id, onEvent]);

  const handleRemoveAccess: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setIsRemoveAccessConfirmOpened(true);
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

  const isMobileCheckboxVisible =
    canAttachFiles && isContextMenu && isTabletScreen();

  return (
    <div
      className={classNames(
        'group/file-item flex select-none justify-between gap-3 rounded px-3 py-1.5 hover:bg-accent-primary-alpha',
        (isHighlighted || isContextMenu) && 'bg-accent-primary-alpha',
        wrapperClassNames,
      )}
      style={{
        paddingLeft: `${1.005 + level * 1.5}rem`,
      }}
      ref={fileRef}
      data-qa="file"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div
          onClick={handleToggleFile}
          className="text-secondary"
          data-qa="attached-file-icon"
        >
          {(!canAttachFiles || !isSelected) &&
          item.status !== UploadStatus.FAILED ? (
            <ShareIcon
              {...item}
              containerClassName={classNames(
                item.status !== UploadStatus.LOADING &&
                  canAttachFiles &&
                  'group-hover/file-item:hidden',
                isMobileCheckboxVisible && 'hidden',
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
                  isSelected || isMobileCheckboxVisible ? 'flex' : 'hidden',
                )}
                data-qa={isSelected ? 'selected' : null}
              >
                <input
                  className="checkbox peer size-[18px] bg-layer-3"
                  type="checkbox"
                  readOnly
                  checked={isSelected}
                  data-qa={isSelected ? 'checked' : 'unchecked'}
                />
                <IconCheck
                  size={18}
                  className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                />
              </div>
            )}
        </div>
        <Tooltip
          hideTooltip={isContextMenu}
          tooltip={item.name}
          isTriggerClickable={isContextMenu}
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
            isSelected={isSelected}
            file={item}
            onDelete={handleDelete}
            onUnshare={handleUnshare}
            isOpen={isContextMenu}
            onOpenChange={setIsContextMenu}
            onRemoveAccess={handleRemoveAccess}
            onUnpublish={handleOpenUnpublishing}
            onSelect={canAttachFiles ? handleToggleFile : undefined}
            className="hidden group-hover/file-item:block"
            onSave={onSave}
          />
        )}
      </div>
      {isRemoveAccessConfirmOpened && (
        <ConfirmDialog
          isOpen={isRemoveAccessConfirmOpened}
          heading={t('Confirm removing access: {{fileName}}', {
            fileName: item.name,
          })}
          description={t(
            'Are you sure you want to remove access to the file for all users?',
          )}
          confirmLabel={t('Confirm')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsRemoveAccessConfirmOpened(false);
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
