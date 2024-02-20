import {
  IconClockShare,
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
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getRootId } from '@/src/utils/app/id';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { getApiKeyByFeatureType } from '@/src/utils/server/api';

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
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: (args?: unknown) => void;
  onReplay?: MouseEventHandler<unknown>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<unknown>;
  onShare?: MouseEventHandler<unknown>;
  onUnshare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onPublishUpdate?: MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onDuplicate?: MouseEventHandler<unknown>;
  onPreview?: MouseEventHandler<unknown>;
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
  onPublishUpdate,
  onOpenChange,
  onDuplicate,
  onPreview,
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

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(featureType === FeatureType.Chat ? 'Rename' : 'Edit'),
        display: !isExternal,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
      },
      {
        name: t('Compare'),
        display: !!onCompare,
        dataQa: 'compare',
        Icon: IconScale,
        onClick: onCompare,
      },
      {
        name: t('Duplicate'),
        display: !!onDuplicate && isExternal,
        dataQa: 'duplicate',
        Icon: IconCopy,
        onClick: onDuplicate,
      },
      {
        name: t('Preview'),
        display: !!onPreview && isExternal,
        dataQa: 'preview',
        Icon: IconEye,
        onClick: onPreview,
      },
      {
        name: t('Replay'),
        display: !isEmptyConversation && !!onReplay,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay,
      },
      {
        name: t('Playback'),
        display: !isEmptyConversation && !!onPlayback,
        dataQa: 'playback',
        Icon: IconPlayerPlay,
        onClick: onPlayback,
      },
      {
        name: t('Export'),
        dataQa: 'export-prompt',
        display: featureType === FeatureType.Prompt,
        Icon: IconFileArrowRight,
        onClick: onExport,
      },
      {
        name: t('Export'),
        dataQa: 'export-chat-mobile',
        display: !isEmptyConversation && featureType === FeatureType.Chat,
        Icon: IconFileArrowRight,
        onClick: onOpenExportModal,
        className: 'md:hidden',
      },
      {
        name: t('Export'),
        display: !isEmptyConversation && featureType === FeatureType.Chat,
        dataQa: 'export-chat',
        Icon: IconFileArrowRight,
        className: 'max-md:hidden',
        childMenuItems: [
          {
            name: t('With attachments'),
            dataQa: 'with-attachments',
            onClick: () => {
              onExport({ withAttachments: true });
            },
            className: 'invisible md:visible',
          },
          {
            name: t('Without attachments'),
            dataQa: 'without-attachments',
            onClick: () => {
              onExport();
            },
            className: 'invisible md:visible',
          },
        ],
      },
      {
        name: t('Move to'),
        display: !isExternal,
        dataQa: 'move-to-mobile',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal,
        className: 'md:hidden',
      },
      {
        name: t('Move to'),
        display: !isExternal,
        dataQa: 'move-to',
        Icon: IconFolderShare,
        className: 'max-md:hidden',
        childMenuItems: [
          {
            name: t('New folder'),
            dataQa: 'new-folder',
            Icon: IconFolderPlus,
            onClick: () => {
              onMoveToFolder({ isNewFolder: true });
            },
            className: classNames('invisible md:visible', {
              'border-b border-primary': folders?.length > 0,
            }),
          },
          ...folders.map((folder) => ({
            name: folder.name,
            dataQa: `folder-${folder.id}`,
            onClick: () => {
              onMoveToFolder({ folderId: folder.id });
            },
          })),
        ],
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display:
          !isEmptyConversation && isSharingEnabled && !!onShare && !isExternal,
        Icon: IconUserShare,
        onClick: onShare,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display:
          !isEmptyConversation &&
          isSharingEnabled &&
          !!onUnshare &&
          entity.isShared,
        Icon: IconUserX,
        onClick: onUnshare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display:
          !isEmptyConversation &&
          isPublishingEnabled &&
          !entity.isPublished &&
          !!onPublish &&
          !isExternal,
        Icon: IconWorldShare,
        onClick: onPublish,
      },
      {
        name: t('Update'),
        dataQa: 'update-publishing',
        display:
          !isEmptyConversation &&
          isPublishingEnabled &&
          !!entity.isPublished &&
          !!onPublishUpdate,
        Icon: IconClockShare,
        onClick: onPublishUpdate,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display:
          !isEmptyConversation &&
          isPublishingEnabled &&
          !!entity.isPublished &&
          !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display:
          entity.id.startsWith(
            getRootId({ apiKey: getApiKeyByFeatureType(featureType) }),
          ) || entity.sharedWithMe,
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [
      t,
      featureType,
      isExternal,
      onRename,
      onCompare,
      onDuplicate,
      isEmptyConversation,
      onReplay,
      onPlayback,
      onExport,
      onOpenExportModal,
      onOpenMoveToModal,
      folders,
      isSharingEnabled,
      onShare,
      onUnshare,
      entity.isShared,
      entity.isPublished,
      entity.id,
      entity.sharedWithMe,
      isPublishingEnabled,
      onPublish,
      onPublishUpdate,
      onUnpublish,
      onDelete,
      onMoveToFolder,
    ],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className={classNames(className)}
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}
