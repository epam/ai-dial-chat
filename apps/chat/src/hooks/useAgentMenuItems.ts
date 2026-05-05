import {
  IconEye,
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconPlugConnected,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useAgentMenuActions } from '@/src/hooks/useAgentActions';
import { useHasDeployAccess } from '@/src/hooks/useHasDeployAccess';

import {
  getApplicationSimpleStatus,
  getPlayerCaption,
  isApplicationDeployed,
  isApplicationStatusUpdating,
  isExecutableApp,
  isMarketplaceEntityPublic,
  isQuickApp2,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { doesAgentSupportMcp } from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { SimpleApplicationStatus } from '@/src/types/applications';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  AuthSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import {
  PlayerContextButtonClasses,
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature } from '@epam/ai-dial-shared';

interface Props {
  entity: DialAIEntityModel;
  disabledActions?: {
    copyLink?: boolean;
    deploy?: boolean;
    edit?: boolean;
    share?: boolean;
    unshare?: boolean;
    publish?: boolean;
    unpublish?: boolean;
    logs?: boolean;
    delete?: boolean;
    connect?: boolean;
  };
  isPreview?: boolean;
  triggerIconSize?: number;
}

export const useAgentMenuItems = ({
  entity,
  disabledActions = {},
  isPreview = false,
}: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const schemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const { dialCoreExternalUrl } = useAppSelector(
    SettingsSelectors.selectDefaults,
  );

  const {
    handleCopy,
    handleDelete,
    handleEdit,
    handleOpenApplicationLogs,
    handleOpenSharing,
    handleOpenUnshare,
    handlePublish,
    handleUnpublish,
    handleUpdateFunctionStatus,
    handleRedeploy,
    handleConnect,
  } = useAgentMenuActions(entity);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);
  const isAppIdPublic = isEntityIdPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const hasDeployAccess = useHasDeployAccess(entity);
  const isExecutable = isExecutableApp(entity) && hasDeployAccess;
  const isMyAppOrPreview = isMyApp || isPreview;
  const isPublicAndAdmin = isAppIdPublic && isAdmin;
  const hasCustomEditor = schemas.some(
    (schema) =>
      schema.id === entity.applicationTypeSchemaId && schema.editorUrl,
  );
  const canEditOrView =
    isMyApp ||
    canWrite ||
    (isPublicAndAdmin && (!hasCustomEditor || isQuickApp2(entity)));

  const showRedeploy = isExecutable && isApplicationDeployed(entity);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t(MarketplaceI18nKeys.Connect),
        dataQa: 'toolset-connect',
        display:
          disabledActions?.connect !== true &&
          doesAgentSupportMcp(entity) &&
          !!dialCoreExternalUrl,
        Icon: IconPlugConnected,
        onClick: handleConnect,
      },
      {
        name: t(MarketplaceI18nKeys.CopyLink),
        dataQa: 'application-copy-link',
        display: isPublicApp && disabledActions.copyLink !== true,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display: isExecutable && disabledActions.deploy !== true,
        Icon: PlayerContextIcons[playerStatus],
        className: PlayerContextButtonClasses[playerStatus],
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: handleUpdateFunctionStatus,
      },
      {
        name: t(MarketplaceI18nKeys.Redeploy),
        dataQa: 'redeploy',
        display: showRedeploy && disabledActions.deploy !== true,
        Icon: PlayerContextIcons[SimpleApplicationStatus.REDEPLOY],
        className: PlayerContextButtonClasses[SimpleApplicationStatus.REDEPLOY],
        iconClassName:
          PlayerContextIconClasses[SimpleApplicationStatus.REDEPLOY],
        onClick: handleRedeploy,
      },
      {
        name: t(
          isAppIdPublic
            ? MarketplaceI18nKeys.ViewMarketplace
            : MarketplaceI18nKeys.EditMarketplace,
        ),
        dataQa: 'edit',
        disabled:
          isExecutable && playerStatus === SimpleApplicationStatus.UPDATING,
        display: canEditOrView && disabledActions.edit !== true,
        Icon: isAppIdPublic ? IconEye : IconPencilMinus,
        onClick: handleEdit,
      },
      {
        name: t(MarketplaceI18nKeys.ShareMarketplace),
        dataQa: 'share',
        display:
          isMyApp &&
          isApplicationsSharingEnabled &&
          disabledActions.share !== true,
        Icon: IconUserShare,
        onClick: handleOpenSharing,
      },
      {
        name: t(MarketplaceI18nKeys.UnshareMarketplace),
        dataQa: 'unshare',
        display:
          !!entity.sharedWithMe &&
          isApplicationsSharingEnabled &&
          disabledActions.unshare !== true,
        Icon: IconUserUnshare,
        onClick: handleOpenUnshare,
      },
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
        name: t(MarketplaceI18nKeys.Logs),
        dataQa: 'app-logs',
        display:
          !!isExecutable &&
          playerStatus === SimpleApplicationStatus.UNDEPLOY &&
          disabledActions.logs !== true,
        Icon: IconFileDescription,
        onClick: handleOpenApplicationLogs,
      },
      {
        name: t(MarketplaceI18nKeys.DeleteMarketplace),
        dataQa: 'delete',
        display: isMyAppOrPreview && disabledActions.delete !== true,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        onClick: handleDelete,
      },
    ],
    [
      dialCoreExternalUrl,
      t,
      disabledActions?.connect,
      disabledActions.copyLink,
      disabledActions.deploy,
      disabledActions.edit,
      disabledActions.share,
      disabledActions.unshare,
      disabledActions.publish,
      disabledActions.unpublish,
      disabledActions.logs,
      disabledActions.delete,
      handleConnect,
      isPublicApp,
      handleCopy,
      entity,
      playerStatus,
      isExecutable,
      handleUpdateFunctionStatus,
      showRedeploy,
      handleRedeploy,
      isAppIdPublic,
      canEditOrView,
      handleEdit,
      isMyApp,
      isApplicationsSharingEnabled,
      handleOpenSharing,
      handleOpenUnshare,
      isMyAppOrPreview,
      handlePublish,
      handleUnpublish,
      handleOpenApplicationLogs,
      isModifyDisabled,
      handleDelete,
    ],
  );

  return menuItems;
};
