import {
  IconDots,
  IconDownload,
  IconTrashX,
  IconUserX,
} from '@tabler/icons-react';
import { MouseEvent, MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { stopBubbling } from '@/src/constants/chat';

import ContextMenu from '../Common/ContextMenu';
import DownloadRenderer from './Download';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { UploadStatus } from '@epam/ai-dial-shared';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: (props?: unknown) => void | MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onUnshare?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
}

export function FileItemContextMenu({
  file,
  className,
  onDelete,
  onOpenChange,
  onUnshare,
  onUnpublish,
}: ContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);

  const isSharingConversationEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Chat),
  );

  const isPublishingConversationEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Chat),
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
        display: isSharingConversationEnabled && !!onUnshare && !!file.isShared,
        Icon: IconUserX,
        onClick: onUnshare,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display:
          isPublishingConversationEnabled &&
          !!file.isPublished &&
          !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display:
          file.id.startsWith(
            getRootId({
              featureType: FeatureType.File,
            }),
          ) || !!file.sharedWithMe,
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [
      file,
      onDelete,
      onOpenChange,
      onUnshare,
      onUnpublish,
      isSharingConversationEnabled,
      isPublishingConversationEnabled,
      t,
    ],
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
