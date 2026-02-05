import {
  IconEye,
  IconKey,
  IconLink,
  IconLogin,
  IconLogout,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';
import {
  getToolsetAuthAction,
  getToolsetAuthActionLabel,
  isToolsetWithAuth,
} from '@/src/utils/app/toolsets';

import { DisplayMenuItemProps } from '@/src/types/menu';
import {
  ToolsetContextMenuDisabledActions,
  ToolsetModel,
} from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { ToolsetAuthAction } from '@/src/constants/toolsets';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';

interface Props {
  entity: ToolsetModel;
  disabledActions?: ToolsetContextMenuDisabledActions;
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const useToolsetMenuItems = ({
  entity,
  disabledActions = {},
  isPreview = false,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);
  const screenState = useScreenState();

  // const isApplicationsSharingEnabled = useAppSelector((state) =>
  //   SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  // );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const {
    handleCopy,
    handleDelete,
    handleEdit,
    handleLogin,
    // handleOpenSharing,
    // handleOpenUnshare,
    handlePublish,
    handleUnpublish,
  } = useToolsetMenuActions(entity);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);
  const isAppIdPublic = isEntityIdPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isMyAppOrPreview = isMyApp || isPreview;
  const isWithAuth = isToolsetWithAuth(entity);
  const authAction = getToolsetAuthAction(entity, isAdmin);

  const canEditOrView = isMyApp || canWrite || (isAppIdPublic && isAdmin);

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
      {
        name: t('Manage creds'),
        dataQa: 'toolset-login',
        display:
          disabledActions.login !== true &&
          isWithAuth &&
          isPublicApp &&
          isAdmin,
        Icon: IconKey,
        onClick: handleLogin,
      },
      {
        name: t(getToolsetAuthActionLabel(authAction, screenState)),
        dataQa: 'toolset-login',
        display:
          disabledActions.login !== true &&
          isWithAuth &&
          !(isPublicApp && isAdmin),
        Icon: authAction === ToolsetAuthAction.LogOut ? IconLogout : IconLogin,
        iconClassName:
          authAction === ToolsetAuthAction.LogOut
            ? 'stroke-error'
            : 'stroke-accent-secondary',
        onClick: handleLogin,
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
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyAppOrPreview && disabledActions.publish !== true,
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isAppIdPublic && disabledActions.unpublish !== true,
        Icon: UnpublishIcon,
        onClick: handleUnpublish,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyAppOrPreview && disabledActions.delete !== true,
        Icon: IconTrashX,
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      disabledActions.copyLink,
      disabledActions.edit,
      disabledActions.login,
      disabledActions.publish,
      disabledActions.unpublish,
      disabledActions.delete,
      handleCopy,
      isAppIdPublic,
      canEditOrView,
      handleEdit,
      isWithAuth,
      isAdmin,
      handleLogin,
      authAction,
      screenState,
      isMyAppOrPreview,
      handlePublish,
      handleUnpublish,
      handleDelete,
    ],
  );

  return menuItems;
};
