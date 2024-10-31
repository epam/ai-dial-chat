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
import { getRootId, isEntityIdExternal } from '@/src/utils/app/id';
import { isEntityPublic } from '@/src/utils/app/publications';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
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
  additionalItemData?: AdditionalItemData;
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
  onSelect,
  isOpen,
  isEmpty,
  additionalItemData,
}: FolderContextMenuProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );

  const isExternal = isEntityIdExternal(folder);
  const isNameInvalid = isEntityNameInvalid(folder.name);
  const isInvalidPath = hasInvalidNameInPath(folder.folderId);
  const disableAll = isNameInvalid || isInvalidPath;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Select'),
        display: !isExternal && !!onSelect && featureType !== FeatureType.File,
        dataQa: 'select',
        Icon: IconSquareCheck,
        onClick: onSelect,
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
          isEntityPublic(folder) &&
          !!onUnpublish &&
          !!additionalItemData?.isSidePanelItem,
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
        display:
          (!!onAddFolder && !isExternal) ||
          !!additionalItemData?.isChangePathFolder,
        dataQa: 'new-folder',
        Icon: IconFolderPlus,
        onClick: onAddFolder,
        disabled:
          (disableAll && !additionalItemData?.isChangePathFolder) ||
          isNameInvalid,
      },
    ],
    [
      t,
      isExternal,
      onSelect,
      featureType,
      onUpload,
      disableAll,
      onRename,
      folder,
      isNameInvalid,
      isEmpty,
      isSharingEnabled,
      onShare,
      onUnshare,
      isPublishingEnabled,
      onPublish,
      onPublishUpdate,
      onUnpublish,
      additionalItemData?.isSidePanelItem,
      additionalItemData?.isChangePathFolder,
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
