import {
  IconClockShare,
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
  IconUpload,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
} from '@/src/utils/app/common';
import { canEditSharedFolderOrParent } from '@/src/utils/app/folders';
import { isEntityIdExternal, isMyEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  FilesSelectors,
  PublicationSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ContextMenu } from './ContextMenu';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';

interface FolderContextMenuProps {
  folder: FolderInterface;
  featureType: FeatureType;
  isOpen?: boolean;
  isEmpty?: boolean;
  additionalItemData?: AdditionalItemData;
  canSelectFolders?: boolean;
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
  isSelected?: boolean;
}

export const FolderContextMenu = ({
  folder,
  featureType,
  canSelectFolders,
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
  isSelected,
}: FolderContextMenuProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const reviewEntities = useAppSelector(
    PublicationSelectors.selectResourcesToReview,
  );

  const isPublicationReviewFolder = useMemo(() => {
    return reviewEntities.some((entity) =>
      entity.reviewUrl.startsWith(`${folder.id}/`),
    );
  }, [folder.id, reviewEntities]);

  const isExternal = isEntityIdExternal(folder);
  const isNameInvalid = isEntityNameInvalid(folder.name);
  const isInvalidPath = hasInvalidNameInPath(folder.folderId);
  const disableAll = isNameInvalid || isInvalidPath;

  const canEditShared = useMemo(() => {
    return canEditSharedFolderOrParent(folders, folder.folderId);
  }, [folder.folderId, folders]);

  const isMyFolder = useMemo(() => {
    return isMyEntity(folder, featureType);
  }, [featureType, folder]);

  const isMyOrCanEdit = isMyFolder || canEditShared;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(isSelected ? 'Unselect' : 'Select'),
        display:
          !isExternal &&
          !!onSelect &&
          (featureType !== FeatureType.File || !!canSelectFolders),
        dataQa: 'select',
        Icon: isSelected ? IconSquareOff : IconSquareCheck,
        onClick: onSelect,
      },
      {
        name: t('Upload'),
        display: !!onUpload && isMyOrCanEdit,
        dataQa: 'upload',
        Icon: IconUpload,
        onClick: onUpload,
        disabled: disableAll,
      },
      {
        name: t('Rename'),
        display:
          !!onRename &&
          (!isExternal || isPublicationReviewFolder || !!folder.temporary),
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
        display: !!onUnshare && !!folder.sharedWithMe,
        dataQa: 'unshare',
        Icon: IconUserUnshare,
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
          isEntityIdPublic(folder) &&
          !!onUnpublish &&
          !!additionalItemData?.isSidePanelItem,
        Icon: UnpublishIcon,
        onClick: onUnpublish,
        disabled: disableAll,
      },
      {
        name: t('Delete'),
        display:
          !!onDelete && (isMyEntity(folder, featureType) || !!folder.temporary),
        dataQa: 'delete',
        Icon: IconTrashX,
        onClick: onDelete,
      },

      {
        name: t('Add new folder'),
        display:
          !!onAddFolder &&
          (isMyOrCanEdit || !!additionalItemData?.isChangePathFolder),
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
      isSelected,
      isExternal,
      onSelect,
      featureType,
      canSelectFolders,
      onUpload,
      isMyOrCanEdit,
      disableAll,
      onRename,
      isPublicationReviewFolder,
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
      className="m-0 justify-self-end p-2"
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
};
