import {
  IconDots,
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconUserShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import classNames from 'classnames';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { DisplayMenuItemProps } from '@/src/types/menu';

import ContextMenu from './ContextMenu';

interface SettingsContextMenuProps {
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
  onReplay?: MouseEventHandler<HTMLButtonElement>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<HTMLButtonElement>;
  onOpenShareModal?: MouseEventHandler<HTMLButtonElement>;
  onOpenChange?: (isOpen: boolean) => void;
}

export default function SettingsContextMenu({
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
  onOpenShareModal,
  onOpenChange,
}: SettingsContextMenuProps) {
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: featureType === FeatureType.Chat ? 'Rename' : 'Edit',
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
      },
      {
        name: 'Compare',
        display: !!onCompare,
        dataQa: 'compare',
        Icon: IconScale,
        onClick: onCompare,
      },
      {
        name: 'Replay',
        display: !isEmptyConversation && !!onReplay,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay,
      },
      {
        name: 'Playback',
        display: !isEmptyConversation && !!onPlayback,
        dataQa: 'playback',
        Icon: IconPlayerPlay,
        onClick: onPlayback,
      },
      {
        name: 'Export',
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: onExport,
      },
      {
        name: 'Move to',
        dataQa: 'move-to',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal,
        className: 'md:hidden',
      },
      {
        name: 'Move to',
        dataQa: 'move-to',
        Icon: IconFolderShare,
        className: 'max-md:hidden',
        menuItems: [
          {
            name: 'New folder',
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
        name: 'Share',
        dataQa: 'share',
        display: !!onOpenShareModal,
        Icon: IconUserShare,
        onClick: onOpenShareModal,
      },
      {
        name: 'Delete',
        dataQa: 'delete',
        Icon: IconUserShare,
        onClick: onDelete,
      },
    ],
    [
      featureType,
      folders,
      isEmptyConversation,
      onCompare,
      onDelete,
      onExport,
      onMoveToFolder,
      onOpenMoveToModal,
      onOpenShareModal,
      onPlayback,
      onRename,
      onReplay,
    ],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      ContextMenuIcon={IconDots}
      contextMenuIconSize={18}
      translation="sidebar"
      highlightColor={highlightColor}
      className={className}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
}
