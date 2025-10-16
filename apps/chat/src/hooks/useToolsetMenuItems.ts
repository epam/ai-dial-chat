import {
  IconEye,
  IconLink,
  IconLogin,
  IconLogout,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useToolsetMenuActions } from '@/src/hooks/useToolsetActions';

import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';

import { DisplayMenuItemProps } from '@/src/types/menu';
import { ToolsetCredentialsLevel, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface Props {
  entity: ToolsetModel;
  disabledActions?: Partial<{
    copyLink: boolean;
    edit: boolean;
    share: boolean;
    unshare: boolean;
    publish: boolean;
    unpublish: boolean;
    delete: boolean;
    login: boolean;
  }>;
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
  const isPublicAndAdmin = isAppIdPublic && isAdmin;
  const isWithAuth =
    entity.authSettings.authenticationType !== ToolsetAuthTypes.NONE;
  const isSignedInGlobal = isToolsetSignedIn(entity);
  const isSignedInUser = isToolsetSignedIn(
    entity,
    ToolsetCredentialsLevel.USER,
  );
  const isSignedIn = isSignedInUser || isSignedInGlobal;
  const canSignOut =
    !isPublicApp || isSignedInUser || (isSignedInGlobal && isPublicAndAdmin);

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
      {
        name: t(isSignedIn && canSignOut ? 'Log out' : 'Log in'),
        dataQa: 'toolset-login',
        display: disabledActions.login !== true && isWithAuth,
        Icon: isSignedIn && canSignOut ? IconLogout : IconLogin,
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
        iconClassName: 'stroke-error',
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
      isSignedIn,
      isWithAuth,
      handleLogin,
      isMyAppOrPreview,
      handlePublish,
      handleUnpublish,
      handleDelete,
    ],
  );

  return menuItems;
};
