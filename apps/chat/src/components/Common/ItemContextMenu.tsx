import {
  IconCopy,
  IconDots,
  IconEye,
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconTrashX,
  IconUserShare,
  IconUserX,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
} from '@/src/utils/app/common';
import { getRootId } from '@/src/utils/app/id';
import { isItemPublic } from '@/src/utils/app/publications';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';

import { FeatureType, ShareEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from './ContextMenu';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';

interface ItemContextMenuProps {
  entity: ShareEntity;
  folders: FolderInterface[];
  featureType: FeatureType;
  isEmptyConversation?: boolean;
  className?: string;
  isOpen?: boolean;
  onOpenMoveToModal: () => void;
  onOpenExportModal?: () => void;
  onMoveToFolder?: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport?: (args?: unknown) => void;
  onReplay?: MouseEventHandler<unknown>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<unknown>;
  onShare?: MouseEventHandler<unknown>;
  onUnshare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onDuplicate?: MouseEventHandler<unknown>;
  onView?: MouseEventHandler<unknown>;
  isLoading?: boolean;
}

export default function ItemContextMenu({
  entity,
  featureType,
  isEmptyConversation,
  className,
  folders,
  isOpen,
  onDelete,
  onRename,
  onExport,
  onOpenExportModal,
  onReplay,
  onCompare,
  onPlayback,
  onMoveToFolder,
  onOpenMoveToModal,
  onShare,
  onUnshare,
  onPublish,
  onUnpublish,
  onOpenChange,
  onDuplicate,
  onView,
  isLoading,
}: ItemContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, entity, featureType),
  );

  const isNameInvalid = isEntityNameInvalid(entity.name);
  const isInvalidPath = hasInvalidNameInPath(entity.folderId);
  const disableAll = isNameInvalid || isInvalidPath;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name:
          featureType === FeatureType.Chat
            ? t('common.button.rename')
            : t('common.button.edit'),
        display: !isExternal,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
        disabled: disableAll && !isNameInvalid,
      },
      {
        name: t('common.button.compare'),
        display: !!onCompare,
        dataQa: 'compare',
        Icon: IconScale,
        onClick: onCompare,
        disabled: disableAll,
      },
      {
        name: t('common.button.duplicate'),
        display: !isEmptyConversation && !!onDuplicate,
        dataQa: 'duplicate',
        Icon: IconCopy,
        onClick: onDuplicate,
        disabled: disableAll,
      },
      {
        name: t('common.button.view'),
        display: !!onView && isExternal,
        dataQa: 'view',
        Icon: IconEye,
        onClick: onView,
      },
      {
        name: t('common.button.replay'),
        display: !isEmptyConversation && !!onReplay,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay,
        disabled: disableAll,
      },
      {
        name: t('common.button.playback'),
        display: !isEmptyConversation && !!onPlayback,
        dataQa: 'playback',
        Icon: IconPlayerPlay,
        onClick: onPlayback,
        disabled: disableAll,
      },
      {
        name: t('common.button.export'),
        dataQa: 'export-prompt',
        display: featureType === FeatureType.Prompt,
        Icon: IconFileArrowRight,
        onClick: onExport,
      },
      {
        name: t('common.button.export'),
        dataQa: 'export-chat-mobile',
        display: !isEmptyConversation && featureType === FeatureType.Chat,
        Icon: IconFileArrowRight,
        onClick: onOpenExportModal,
        className: 'md:hidden',
      },
      {
        name: t('common.button.export'),
        display:
          !isEmptyConversation &&
          featureType === FeatureType.Chat &&
          !!onExport,
        dataQa: 'export-chat',
        Icon: IconFileArrowRight,
        className: 'max-md:hidden',
        childMenuItems: [
          {
            name: t('common.button.with_attachments'),
            dataQa: 'with-attachments',
            onClick: () => {
              onExport && onExport({ withAttachments: true });
            },
            className: 'invisible md:visible',
          },
          {
            name: t('common.button.without_attachments'),
            dataQa: 'without-attachments',
            onClick: () => {
              onExport && onExport();
            },
            className: 'invisible md:visible',
          },
        ],
      },
      {
        name: t('common.button.move_to'),
        display: !isExternal,
        dataQa: 'move-to-mobile',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal,
        className: 'md:hidden',
        disabled: disableAll,
      },
      {
        name: t('common.button.move_to'),
        display: !isExternal && !!onMoveToFolder,
        dataQa: 'move-to',
        Icon: IconFolderShare,
        className: 'max-md:hidden',
        disabled: disableAll,
        childMenuItems: [
          {
            name: t('common.button.new_folder'),
            dataQa: 'new-folder',
            Icon: IconFolderPlus,
            onClick: () => {
              onMoveToFolder && onMoveToFolder({ isNewFolder: true });
            },
            className: classNames('invisible md:visible', {
              'border-b border-primary': folders?.length > 0,
            }),
          },
          ...folders.map((folder) => ({
            name: folder.name,
            dataQa: `folder-${folder.id}`,
            onClick: () => {
              onMoveToFolder && onMoveToFolder({ folderId: folder.id });
            },
          })),
        ],
      },
      {
        name: t('common.button.share'),
        dataQa: 'share',
        display:
          !isEmptyConversation && isSharingEnabled && !!onShare && !isExternal,
        Icon: IconUserShare,
        onClick: onShare,
        disabled: disableAll,
      },
      {
        name: t('common.button.unshare'),
        dataQa: 'unshare',
        display:
          !isEmptyConversation &&
          isSharingEnabled &&
          !!onUnshare &&
          !!entity.isShared,
        Icon: IconUserX,
        onClick: onUnshare,
        disabled: disableAll,
      },
      // TODO: implement publication update in https://github.com/epam/ai-dial-chat/issues/318
      // {
      //   name: t('common.button.publish'),
      //   dataQa: 'update-publishing',
      //   display:
      //     !isEmptyConversation &&
      //     isPublishingEnabled &&
      //     !!entity.isPublished &&
      //     !!onPublishUpdate,
      //   Icon: IconClockShare,
      //   onClick: onPublishUpdate,
      //   disabled: disableAll,
      // },
      {
        name: t('common.button.unpublish'),
        dataQa: 'unpublish',
        display:
          isPublishingEnabled && !!onUnpublish && isItemPublic(entity.id),
        Icon: UnpublishIcon,
        onClick: onUnpublish,
        disabled: disableAll,
      },
      {
        name: t('common.button.delete'),
        dataQa: 'delete',
        display:
          entity.id.startsWith(
            getRootId({
              featureType,
            }),
          ) || !!entity.sharedWithMe,
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      disableAll,
      entity.id,
      entity.isPublished,
      entity.isShared,
      entity.sharedWithMe,
      featureType,
      folders,
      isEmptyConversation,
      isExternal,
      isNameInvalid,
      isPublishingEnabled,
      isSharingEnabled,
      onCompare,
      onDelete,
      onDuplicate,
      onExport,
      onMoveToFolder,
      onOpenExportModal,
      onOpenMoveToModal,
      onPlayback,
      onPublish,
      onRename,
      onReplay,
      onShare,
      onUnpublish,
      onUnshare,
      onView,
      t,
    ],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      isLoading={isLoading}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className={className}
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}
