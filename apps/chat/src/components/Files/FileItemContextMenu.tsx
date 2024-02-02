import { IconDots, IconDownload, IconTrashX } from '@tabler/icons-react';
import { MouseEvent, MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { stopBubbling } from '@/src/constants/chat';

import ContextMenu from '../Common/ContextMenu';
import DownloadRenderer from './Download';
import { UploadStatus } from '@/src/types/common';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
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
        display: file.status !== UploadStatus.LOADING && file.status !== UploadStatus.FAILED,
        dataQa: 'download',
        Icon: IconDownload,
        onClick: (e: MouseEvent) => stopBubbling(e),
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
      className={className}
    />
  );
}
