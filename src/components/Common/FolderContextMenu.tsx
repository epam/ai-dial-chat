import {
  IconClockShare,
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from './ContextMenu';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';

interface FolderContextMenuProps {
  folder: FolderInterface;
  featureType?: FeatureType;
  onDelete?: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onAddFolder?: MouseEventHandler;
  onOpenChange?: (isOpen: boolean) => void;
  isOpen?: boolean;
  onShare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onPublishUpdate?: MouseEventHandler<unknown>;
}
export const FolderContextMenu = ({
  folder,
  featureType,
  onDelete,
  onRename,
  onAddFolder,
  onOpenChange,
  onShare,
  onPublish,
  onUnpublish,
  onPublishUpdate,
  isOpen,
}: FolderContextMenuProps) => {
  const { t } = useTranslation(Translation.SideBar);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
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
        name: t('Share'),
        display: isSharingEnabled && !!onShare,
        dataQa: 'share',
        Icon: IconUserShare,
        onClick: onShare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isPublishingEnabled && !folder.isPublished && !!onPublish,
        Icon: IconWorldShare,
        onClick: onPublish,
      },
      {
        name: t('Update'),
        dataQa: 'update-publishing',
        display:
          isPublishingEnabled && !!folder.isPublished && !!onPublishUpdate,
        Icon: IconClockShare,
        onClick: onPublishUpdate,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isPublishingEnabled && !!folder.isPublished && !!onUnpublish,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
      },
      {
        name: t('Delete'),
        display: !!onDelete,
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
      {
        name: t('Add new folder'),
        display: !!onAddFolder,
        dataQa: 'new-folder',
        Icon: IconFolderPlus,
        onClick: onAddFolder,
      },
    ],
    [
      t,
      onRename,
      isSharingEnabled,
      onShare,
      isPublishingEnabled,
      folder.isPublished,
      onPublish,
      onPublishUpdate,
      onUnpublish,
      onDelete,
      onAddFolder,
    ],
  );

  if (!onDelete && !onRename && !onAddFolder) {
    return null;
  }

  return (
    <ContextMenu
      menuItems={menuItems}
      TriggerIcon={IconDots}
      triggerIconSize={18}
      className="m-0 justify-self-end"
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
};
