import {
  IconEye,
  IconLink,
  IconPencilMinus,
  IconTrashX,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useToolsetMenuActions } from '@/src/hooks/useToolsetMenuActions';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { DisplayMenuItemProps } from '@/src/types/menu';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

interface Props {
  entity: ToolsetModel;
  disabledActions?: {
    copyLink?: boolean;
    edit?: boolean;
    share?: boolean;
    unshare?: boolean;
    publish?: boolean;
    unpublish?: boolean;
    delete?: boolean;
  };
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const useToolsetMenuItems = ({
  entity,
  disabledActions = {},
  isPreview = false,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  // const isApplicationsSharingEnabled = useAppSelector((state) =>
  //   SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  // );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const {
    handleCopy,
    handleDelete,
    handleEdit,
    // handleOpenSharing,
    // handleOpenUnshare,
    // handlePublish,
    // handleUnpublish,
  } = useToolsetMenuActions(entity);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);
  const isAppIdPublic = isEntityIdPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isMyAppOrPreview = isMyApp || isPreview;
  const isPublicAndAdmin = isAppIdPublic && isAdmin;

  const canEditOrView = isMyApp || canWrite || isPublicAndAdmin;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'toolset-copy-link',
        display: isPublicApp && disabledActions.copyLink !== true,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(isAppIdPublic ? 'View' : 'Edit'),
        dataQa: 'edit',
        display: canEditOrView && disabledActions.edit !== true,
        Icon: isAppIdPublic ? IconEye : IconPencilMinus,
        onClick: handleEdit,
      },
      // {
      //   name: t('Share'),
      //   dataQa: 'share',
      //   display:
      //     isMyApp &&
      //     isApplicationsSharingEnabled &&
      //     disabledActions.share !== true,
      //   Icon: IconUserShare,
      //   onClick: handleOpenSharing,
      // },
      // {
      //   name: t('Unshare'),
      //   dataQa: 'unshare',
      //   display:
      //     !!entity.sharedWithMe &&
      //     isApplicationsSharingEnabled &&
      //     disabledActions.unshare !== true,
      //   Icon: IconUserUnshare,
      //   onClick: handleOpenUnshare,
      // },
      // {
      //   name: t('Publish'),
      //   dataQa: 'publish',
      //   display: isMyAppOrPreview && disabledActions.publish !== true,
      //   Icon: IconWorldShare,
      //   onClick: handlePublish,
      // },
      // {
      //   name: t('Unpublish'),
      //   dataQa: 'unpublish',
      //   display: isAppIdPublic && disabledActions.unpublish !== true,
      //   Icon: UnpublishIcon,
      //   onClick: handleUnpublish,
      // },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyAppOrPreview && disabledActions.delete !== true,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      disabledActions.copyLink,
      disabledActions.edit,
      disabledActions.delete,
      handleCopy,
      isAppIdPublic,
      canEditOrView,
      handleEdit,
      isMyAppOrPreview,
      handleDelete,
    ],
  );

  return menuItems;
};
