import {
  IconClockShare,
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconTrashX,
  IconUpload,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isExternalEntity } from '@/src/utils/app/share';

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
  isOpen?: boolean;
  onDelete?: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onAddFolder?: MouseEventHandler;
  onOpenChange?: (isOpen: boolean) => void;
  onShare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onPublishUpdate?: MouseEventHandler<unknown>;
  onUpload?: MouseEventHandler<unknown>;
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
  onUpload,
  isOpen,
}: FolderContextMenuProps) => {
  const { t } = useTranslation(Translation.SideBar);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isExternal = useAppSelector((state) =>
    isExternalEntity(state, folder, featureType),
  );
  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Upload'),
        display: !!onUpload && !isExternal,
        dataQa: 'upload',
        Icon: IconUpload,
        onClick: onUpload,
      },
      {
        name: t('Rename'),
        display: !!onRename && !isExternal,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
      },
      {
        name: t('Share'),
        display: isSharingEnabled && !!onShare && !isExternal,
        dataQa: 'share',
        Icon: IconUserShare,
        onClick: onShare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display:
          isPublishingEnabled &&
          !folder.isPublished &&
          !!onPublish &&
          !isExternal,
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
      onUpload,
      isExternal,
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
