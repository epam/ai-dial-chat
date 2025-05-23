import {
  IconDeviceFloppy,
  IconDots,
  IconDownload,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
  IconUserX,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useMenuItemHandler } from '@/src/hooks/useHandler';
import { useTranslation } from '@/src/hooks/useTranslation';

import { canEditSharedFolderOrParent } from '@/src/utils/app/folders';
import { isMyEntity } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  CodeEditorSelectors,
  FilesSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { DownloadRenderer } from './Download';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { UploadStatus } from '@epam/ai-dial-shared';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  isOpen: boolean;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
  onUnshare: (props?: unknown) => void | MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onRemoveAccess?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onSave?: (fileId: string) => void | MouseEventHandler<unknown>;
  onSelect?: MouseEventHandler<unknown>;
  isSelected?: boolean;
}

export function FileItemContextMenu({
  file,
  className,
  isOpen,
  onDelete,
  onUnshare,
  onOpenChange,
  onRemoveAccess,
  onUnpublish,
  onSave,
  onSelect,
  isSelected,
}: ContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);

  const isSharingConversationEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Chat),
  );
  const isPublishingConversationEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Chat),
  );
  const selectFileContentSelector = useMemo(
    () => CodeEditorSelectors.selectFileContent(file.id),
    [file.id],
  );
  const isCodeEditorFile = !!useAppSelector(selectFileContentSelector);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const handleSave = useMenuItemHandler(onSave, file.id);
  const handleDownload = useMenuItemHandler(onOpenChange, false, false);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(isSelected ? 'Unselect' : 'Select'),
        dataQa: 'select',
        display: !!onSelect && !isOverlay,
        Icon: isSelected ? IconSquareOff : IconSquareCheck,
        onClick: onSelect,
      },
      {
        name: t('Save'),
        dataQa: 'save',
        additionalNameNode: isCodeEditorFile ? (
          <span className="pl-2 text-secondary">
            {navigator.userAgent.toLowerCase().includes('mac')
              ? 'Cmd+S'
              : 'Ctrl+S'}
          </span>
        ) : null,
        display: !!onSave,
        Icon: IconDeviceFloppy,
        onClick: handleSave,
      },
      {
        name: t('Download'),
        display:
          file.status !== UploadStatus.LOADING &&
          file.status !== UploadStatus.FAILED,
        dataQa: 'download',
        Icon: IconDownload,
        onClick: handleDownload,
        customTriggerData: file,
        CustomTriggerRenderer: DownloadRenderer,
      },
      {
        name: t('Remove access'),
        dataQa: 'unshare',
        display:
          isSharingConversationEnabled && !!onRemoveAccess && !!file.isShared,
        Icon: IconUserX,
        onClick: onRemoveAccess,
      },
      {
        name: t('Unshare'),
        display: !!file.sharedWithMe,
        dataQa: 'unshare-file',
        Icon: IconUserUnshare,
        onClick: onUnshare,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display:
          isPublishingConversationEnabled &&
          !!file.isPublished &&
          !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display:
          isMyEntity(file, FeatureType.File) ||
          canEditSharedFolderOrParent(folders, file.folderId),
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [
      t,
      isCodeEditorFile,
      onSave,
      handleSave,
      file,
      handleDownload,
      isSharingConversationEnabled,
      onRemoveAccess,
      onUnshare,
      isPublishingConversationEnabled,
      onUnpublish,
      folders,
      onDelete,
      isOverlay,
      onSelect,
      isSelected,
    ],
  );

  return (
    <ContextMenu
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className={className}
      featureType={FeatureType.File}
    />
  );
}
