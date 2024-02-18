import {
  IconClockShare,
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconTrashX,
  IconUpload,
  IconUserShare,
  IconUserX,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getRootId } from '@/src/utils/app/id';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { getApiKeyByFeatureType } from '@/src/utils/server/api';

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
  featureType: FeatureType;
  isOpen?: boolean;
  onDelete?: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onAddFolder?: MouseEventHandler;
  onOpenChange?: (isOpen: boolean) => void;
  onShare?: MouseEventHandler<unknown>;
  onUnshare?: MouseEventHandler<unknown>;
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
  onUnshare,
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
    isEntityOrParentsExternal(state, folder, featureType),
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
        name: t('Unshare'),
        display:
          isSharingEnabled && !!onUnshare && !isExternal && folder.isShared,
        dataQa: 'unshare',
        Icon: IconUserX,
        onClick: onUnshare,
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
        display:
          !!onDelete &&
          folder.id.startsWith(
            getRootId({ apiKey: getApiKeyByFeatureType(featureType) }),
          ),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
      {
        name: t('Delete'),
        display: !!onDelete && folder.sharedWithMe,
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
      onUnshare,
      folder.isShared,
      folder.isPublished,
      folder.id,
      folder.sharedWithMe,
      isPublishingEnabled,
      onPublish,
      onPublishUpdate,
      onUnpublish,
      onDelete,
      featureType,
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
