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
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
  onRename: (props?: unknown) => void | MouseEventHandler<unknown>;
  onExport: (props?: unknown) => void | MouseEventHandler<unknown>;
  onReplay?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onCompare?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onPlayback?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onShare?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onPublish?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onUnpublish?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onPublishUpdate?: (props?: unknown) => void | MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onDuplicate?: (props?: unknown) => void | MouseEventHandler<unknown>;
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
        name: t('Replay'),
        display: !isEmptyConversation && !!onReplay,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay,
      },
      {
        name: t('Playback'),
        display: !isEmptyConversation && !!onPlayback && !isExternal,
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
        display: isSharingEnabled && !!onShare && !isExternal,
        Icon: IconUserShare,
        onClick: onShare,
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
