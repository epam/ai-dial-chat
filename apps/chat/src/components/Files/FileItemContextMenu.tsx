import {
  IconDots,
  IconDownload,
  IconTrashX,
  IconUserX,
} from '@tabler/icons-react';
import { MouseEvent, MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { stopBubbling } from '@/src/constants/chat';

import ContextMenu from '../Common/ContextMenu';
import DownloadRenderer from './Download';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onUnshare?: MouseEventHandler<unknown>;
}

export function FileItemContextMenu({
  file,
  className,
  onDelete,
  onOpenChange,
  onUnshare,
}: ContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);

  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.File),
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Download'),
        display:
          file.status !== UploadStatus.LOADING &&
          file.status !== UploadStatus.FAILED,
        dataQa: 'download',
        Icon: IconDownload,
        onClick: (e: MouseEvent) => {
          stopBubbling(e);
          onOpenChange?.(false);
        },
        className: 'flex gap-3',
        customTriggerData: file,
        CustomTriggerRenderer: DownloadRenderer,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: isSharingEnabled && !!onUnshare && !!file.isShared,
        Icon: IconUserX,
        onClick: onUnshare,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [file, onDelete, onOpenChange, onUnshare, isSharingEnabled, t],
  );

  return (
    <ContextMenu
      onOpenChange={onOpenChange}
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className={className}
      featureType={FeatureType.File}
    />
  );
}
