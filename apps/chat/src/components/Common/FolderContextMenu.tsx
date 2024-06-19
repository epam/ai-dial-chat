import {
  IconClockShare,
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconSquareCheck,
  IconTrashX,
  IconUpload,
  IconUserShare,
  IconUserX,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
} from '@/src/utils/app/common';
import { getRootId } from '@/src/utils/app/id';
import { isItemPublic } from '@/src/utils/app/publications';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';

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
  isEmpty?: boolean;
  isSidePanelFolder?: boolean;
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
  onSelect?: MouseEventHandler<unknown>;
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
  isEmpty,
  isSidePanelFolder,
  onSelect,
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

  const isNameInvalid = isEntityNameInvalid(folder.name);
  const isInvalidPath = hasInvalidNameInPath(folder.folderId);
  const disableAll = isNameInvalid || isInvalidPath;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Select'),
        display: !isExternal && !!onSelect,
        dataQa: 'select',
        Icon: IconSquareCheck,
        onClick: onSelect,
        disabled: disableAll,
      },
      {
        name: t('Upload'),
        display: !!onUpload && !isExternal,
        dataQa: 'upload',
        Icon: IconUpload,
        onClick: onUpload,
        disabled: disableAll,
      },
      {
        name: t('Rename'),
        display: (!!onRename && !isExternal) || !!folder.temporary,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
        disabled: disableAll && !isNameInvalid,
      },
      {
        name: t('Share'),
        display: !isEmpty && isSharingEnabled && !!onShare && !isExternal,
        dataQa: 'share',
        Icon: IconUserShare,
        onClick: onShare,
        disabled: disableAll,
      },
      {
        name: t('Unshare'),
        display:
          isSharingEnabled && !!onUnshare && !isExternal && !!folder.isShared,
        dataQa: 'unshare',
        Icon: IconUserX,
        onClick: onUnshare,
        disabled: disableAll,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display:
          !isEmpty &&
          isPublishingEnabled &&
          !folder.isPublished &&
          !!onPublish &&
          !isExternal,
        Icon: IconWorldShare,
        onClick: onPublish,
        disabled: disableAll,
      },
      {
        name: t('Update'),
        dataQa: 'update-publishing',
        display:
          !isEmpty &&
          isPublishingEnabled &&
          !!folder.isPublished &&
          !!onPublishUpdate,
        Icon: IconClockShare,
        onClick: onPublishUpdate,
        disabled: disableAll,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display:
          isPublishingEnabled &&
          isItemPublic(folder.id) &&
          !!onUnpublish &&
          isSidePanelFolder,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
        disabled: disableAll,
      },
      {
        name: t('Delete'),
        display:
          (!!onDelete &&
            folder.id.startsWith(
              getRootId({
                featureType,
              }),
            )) ||
          !!folder.temporary,
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },
      {
        name: t('Delete'),
        display: !!onDelete && !!folder.sharedWithMe,
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
        disabled: disableAll,
      },
    ],
    [
      t,
      isExternal,
      onSelect,
      disableAll,
      onUpload,
      onRename,
      folder.temporary,
      folder.isShared,
      folder.isPublished,
      folder.id,
      folder.sharedWithMe,
      isNameInvalid,
      isEmpty,
      isSharingEnabled,
      onShare,
      onUnshare,
      isPublishingEnabled,
      onPublish,
      onPublishUpdate,
      onUnpublish,
      isSidePanelFolder,
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
