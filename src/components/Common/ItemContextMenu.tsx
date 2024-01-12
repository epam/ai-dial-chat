import {
  IconClockShare,
  IconCopy,
  IconDots,
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { hasExternalParent, isEntityExternal } from '@/src/utils/app/share';

import { FeatureType, ShareEntity } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { DisplayMenuItemProps, onClickMenuItemHandler } from '@/src/types/menu';
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
  onDuplicate?: MouseEventHandler<unknown>;
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
  onDuplicate,
}: ItemContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isExternalEntity = isEntityExternal(entity);
  const _hasExternalParent = useAppSelector((state) =>
    hasExternalParent(state, entity.folderId, featureType),
  );
  const isExternal = isExternalEntity || _hasExternalParent;
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(featureType === FeatureType.Chat ? 'Rename' : 'Edit'),
        display: !isExternal,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename as onClickMenuItemHandler,
      },
      {
        name: t('Compare'),
        display: !!onCompare,
        dataQa: 'compare',
        Icon: IconScale,
        onClick: onCompare as onClickMenuItemHandler,
      },
      {
        name: t('Duplicate'),
        display: !!onDuplicate && isExternal,
        dataQa: 'duplicate',
        Icon: IconCopy,
        onClick: onDuplicate as onClickMenuItemHandler,
      },
      {
        name: t('Replay'),
        display: !isEmptyConversation && !!onReplay,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay as onClickMenuItemHandler,
      },
      {
        name: t('Playback'),
        display: !isEmptyConversation && !!onPlayback && !isExternal,
        dataQa: 'playback',
        Icon: IconPlayerPlay,
        onClick: onPlayback as onClickMenuItemHandler,
      },
      {
        name: t('Export'),
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: onExport as onClickMenuItemHandler,
      },
      {
        name: t('Move to'),
        display: !isExternal,
        dataQa: 'move-to-mobile',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal as onClickMenuItemHandler,
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
        display: isSharingEnabled && !!onShare && !isExternal,
        Icon: IconUserShare,
        onClick: onShare as onClickMenuItemHandler,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display:
          isPublishingEnabled &&
          !entity.isPublished &&
          !!onPublish &&
          !isExternal,
        Icon: IconWorldShare,
        onClick: onPublish as onClickMenuItemHandler,
      },
      {
        name: t('Update'),
        dataQa: 'update-publishing',
        display:
          isPublishingEnabled && !!entity.isPublished && !!onPublishUpdate,
        Icon: IconClockShare,
        onClick: onPublishUpdate as onClickMenuItemHandler,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isPublishingEnabled && !!entity.isPublished && !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish as onClickMenuItemHandler,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete as onClickMenuItemHandler,
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
      className={classNames(className)}
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}
