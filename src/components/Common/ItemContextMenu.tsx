import {
  IconClockShare,
  IconDots,
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType, HighlightColor, ShareEntity } from '@/src/types/common';
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
  highlightColor: HighlightColor;
  isEmptyConversation?: boolean;
  className?: string;
  isOpen?: boolean;
  onOpenMoveToModal: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay?: MouseEventHandler<unknown>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<unknown>;
  onShare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onPublishUpdate?: MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function ItemContextMenu({
  entity,
  featureType,
  isEmptyConversation,
  className,
  highlightColor,
  folders,
  isOpen,
  onDelete,
  onRename,
  onExport,
  onReplay,
  onCompare,
  onPlayback,
  onMoveToFolder,
  onOpenMoveToModal,
  onShare,
  onPublish,
  onUnpublish,
  onPublishUpdate,
  onOpenChange,
}: ItemContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(featureType === FeatureType.Chat ? 'Rename' : 'Edit'),
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
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: onExport,
      },
      {
        name: t('Move to'),
        dataQa: 'move-to-mobile',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal,
        className: 'md:hidden',
      },
      {
        name: t('Move to'),
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
              'border-b border-gray-400 dark:border-gray-600':
                folders?.length > 0,
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
        display: isSharingEnabled && !!onShare,
        Icon: IconUserShare,
        onClick: onShare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isPublishingEnabled && !entity.isPublished && !!onPublish,
        Icon: IconWorldShare,
        onClick: onPublish,
      },
      {
        name: t('Update'),
        dataQa: 'update-publishing',
        display:
          isPublishingEnabled && !!entity.isPublished && !!onPublishUpdate,
        Icon: IconClockShare,
        onClick: onPublishUpdate,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isPublishingEnabled && !!entity.isPublished && !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [
      t,
      featureType,
      onRename,
      onCompare,
      isEmptyConversation,
      onReplay,
      onPlayback,
      onExport,
      onOpenMoveToModal,
      folders,
      isSharingEnabled,
      onShare,
      isPublishingEnabled,
      entity.isPublished,
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
      highlightColor={highlightColor}
      className={className}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}
