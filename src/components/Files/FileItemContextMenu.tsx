import { IconDots, IconDownload, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';

import ContextMenu from '../Common/ContextMenu';
import DownloadRenderer from './Download';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
}

export function FileItemContextMenu({
  file,
  className,
  onDelete,
  onOpenChange,
}: ContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Download'),
        display: file.status !== 'UPLOADING' && file.status !== 'FAILED',
        dataQa: 'download',
        Icon: IconDownload,
        onClick: stopBubbling,
        className: 'flex gap-3',
        customTriggerData: file,
        CustomTriggerRenderer: DownloadRenderer,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [file, onDelete, t],
  );

  return (
    <ContextMenu
      onOpenChange={onOpenChange}
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      highlightColor={HighlightColor.Blue}
      className={className}
    />
  );
}
