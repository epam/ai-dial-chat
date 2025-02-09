import {
  IconDeviceFloppy,
  IconDots,
  IconDownload,
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

import { CodeEditorSelectors } from '@/src/store/codeEditor/codeEditor.reducer';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from '../Common/ContextMenu';
import DownloadRenderer from './Download';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { UploadStatus } from '@epam/ai-dial-shared';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onUnshare?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onSave?: (fileId: string) => void | MouseEventHandler<unknown>;
}

export function FileItemContextMenu({
  file,
  className,
  onDelete,
  onOpenChange,
  onUnshare,
  onUnpublish,
  onSave,
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

  const handleSave = useMenuItemHandler(onSave, file.id);
  const handleDownload = useMenuItemHandler(onOpenChange, false, false);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
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
        name: t('Unshare'),
        dataQa: 'unshare',
        display: isSharingConversationEnabled && !!onUnshare && !!file.isShared,
        Icon: IconUserX,
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
          !!file.sharedWithMe ||
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
      onUnshare,
      isPublishingConversationEnabled,
      onUnpublish,
      folders,
      onDelete,
    ],
  );

  return (
    <ContextMenu
      onOpenChange={onOpenChange}
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className={className}
      featureType={FeatureType.File}
    />
  );
}
