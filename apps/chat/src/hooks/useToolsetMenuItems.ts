import {
  IconEye,
  IconHammer,
  IconKey,
  IconLink,
  IconLogin,
  IconLogout,
  IconPencilMinus,
  IconPlugConnected,
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
  canRepairToolset,
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
import { AuthSelectors, SettingsSelectors } from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
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
  const { dialCoreExternalUrl } = useAppSelector(
    SettingsSelectors.selectDefaults,
  );

  const {
    handleCopy,
    handleDelete,
    handleEdit,
    handleLogin,
    // handleOpenSharing,
    // handleOpenUnshare,
    handlePublish,
    handleUnpublish,
    handleConnect,
    handleRepair,
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
      {
        name: t(MarketplaceI18nKeys.ManageCreds),
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
        name: t(MarketplaceI18nKeys.Repair),
        dataQa: 'toolset-repair',
        display:
          disabledActions?.repair !== true && canRepairToolset(entity, isAdmin),
        Icon: IconHammer,
        onClick: handleRepair,
      },
      {
        name: t(MarketplaceI18nKeys.Connect),
        dataQa: 'toolset-connect',
        display: disabledActions?.connect !== true && !!dialCoreExternalUrl,
        Icon: IconPlugConnected,
        onClick: handleConnect,
      },
      {
        name: t(MarketplaceI18nKeys.CopyLink),
        dataQa: 'toolset-copy-link',
        display: isPublicApp && disabledActions.copyLink !== true,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(
          isAppIdPublic
            ? MarketplaceI18nKeys.ViewMarketplace
            : MarketplaceI18nKeys.EditMarketplace,
        ),
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
      {
        name: t(MarketplaceI18nKeys.PublishMarketplace),
        dataQa: 'publish',
        display: isMyAppOrPreview && disabledActions.publish !== true,
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: t(MarketplaceI18nKeys.UnpublishMarketplace),
        dataQa: 'unpublish',
        display: isAppIdPublic && disabledActions.unpublish !== true,
        Icon: UnpublishIcon,
        onClick: handleUnpublish,
      },
      {
        name: t(MarketplaceI18nKeys.DeleteMarketplace),
        dataQa: 'delete',
        display: isMyAppOrPreview && disabledActions.delete !== true,
        Icon: IconTrashX,
        onClick: handleDelete,
      },
    ],
    [
      t,
      authAction,
      screenState,
      disabledActions.login,
      disabledActions?.repair,
      disabledActions?.connect,
      disabledActions.copyLink,
      disabledActions.edit,
      disabledActions.publish,
      disabledActions.unpublish,
      disabledActions.delete,
      isWithAuth,
      isPublicApp,
      isAdmin,
      handleLogin,
      entity,
      handleRepair,
      dialCoreExternalUrl,
      handleConnect,
      handleCopy,
      isAppIdPublic,
      canEditOrView,
      handleEdit,
      isMyAppOrPreview,
      handlePublish,
      handleUnpublish,
      handleDelete,
    ],
  );

  return menuItems;
};
