import { IconDots, IconDownload, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { HighlightColor } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';

import { stopBubbling } from '@/src/constants/chat';

import ContextMenu from '../Common/ContextMenu';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: MouseEventHandler<unknown>;
}

export function FileItemContextMenu({
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
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [file.status, onDelete],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      ContextMenuIcon={IconDots}
      contextMenuIconSize={18}
      translation="sidebar"
      highlightColor={HighlightColor.Blue}
      className={className}
    />
  );
}
