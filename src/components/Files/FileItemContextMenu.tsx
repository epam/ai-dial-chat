import { IconDots, IconDownload, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';
import { DialFile } from '@/src/types/files';
import { stopBubbling } from '@/src/constants/chat';
import { HighlightColor } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import BaseContextMenu from '../Common/BaseContextMenu';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: MouseEventHandler<unknown>;
}

export function FileItemContextMenu ({
  file,
  className,
  onDelete,
}: ContextMenuProps) {
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: 'Download',
        display: file.status !== 'UPLOADING' && file.status !== 'FAILED',
        dataQa: 'download',
        Icon: IconDownload,
        onClick: stopBubbling,
      },
      {
        name: 'Delete',
        display: true,
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],[file.status, onDelete])

  return (
    <BaseContextMenu
      menuItems={menuItems}
      ContextMenuIcon={IconDots}
      contextMenuIconSize={16}
      translation="sidebar"
      highlightColor={HighlightColor.Blue}
      className={className}
    />
  );
};
