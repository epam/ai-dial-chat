import {
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconTrashX,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import ContextMenu from './ContextMenu';

interface FolderContextMenuProps {
  onDelete?: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onAddFolder?: MouseEventHandler;
  onOpenChange?: (isOpen: boolean) => void;
  highlightColor: HighlightColor;
  isOpen?: boolean;
}
export const FolderContextMenu = ({
  onDelete,
  onRename,
  onAddFolder,
  onOpenChange,
  highlightColor,
  isOpen,
}: FolderContextMenuProps) => {
  const { t } = useTranslation(Translation.SideBar);
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Rename'),
        display: !!onRename,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
      },
      {
        name: t('Delete'),
        display: !!onDelete,
        dataQa: 'rename',
        Icon: IconTrashX,
        onClick: onDelete,
      },
      {
        name: t('Add new folder'),
        display: !!onAddFolder,
        dataQa: 'rename',
        Icon: IconFolderPlus,
        onClick: onAddFolder,
      },
    ],
    [t, onRename, onDelete, onAddFolder],
  );

  if (!onDelete && !onRename && !onAddFolder) {
    return null;
  }

  return (
    <ContextMenu
      menuItems={menuItems}
      ContextMenuIcon={IconDots}
      contextMenuIconSize={18}
      highlightColor={highlightColor}
      className="m-0 justify-self-end"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
};
