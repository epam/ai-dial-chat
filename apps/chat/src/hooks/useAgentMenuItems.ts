import {
  IconCopy,
  IconEye,
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useAgentActions } from '@/src/hooks/useAgentActions';

import {
  getApplicationSimpleStatus,
  getPlayerCaption,
  isApplicationPublic,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { SimpleApplicationStatus } from '@/src/types/applications';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import {
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
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

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const schemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const {
    handleCopy,
    handleUpdateFunctionStatus,
    handleEdit,
    handleDuplicate,
    handleOpenSharing,
    handleOpenUnshare,
    handlePublish,
    handleUnpublish,
    handleDelete,
    handleOpenApplicationLogs,
  } = useAgentActions(entity);

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);
  const isAppIdPublic = isEntityIdPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const isExecutable =
    isExecutableApp(entity) && (isMyApp || canWrite || isAdmin);
  const isMyAppOrPreview = isMyApp || isPreview;
  const isPublicAndAdmin = isAppIdPublic && isAdmin;
  const hasCustomEditor = schemas.some(
    (schema) =>
      schema.id === entity.applicationTypeSchemaId && schema.editorUrl,
  );
  const canEditOrView =
    isMyApp || canWrite || (isPublicAndAdmin && !hasCustomEditor);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'application-copy-link',
        display: isPublicApp && disabledActions.copyLink !== true,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display:
          isExecutable && isCodeAppsEnabled && disabledActions.deploy !== true,
        Icon: PlayerContextIcons[playerStatus],
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: handleUpdateFunctionStatus,
      },
      {
        name: t(isAppIdPublic ? 'View' : 'Edit'),
        dataQa: 'edit',
        display: canEditOrView && disabledActions.edit !== true,
        Icon: isAppIdPublic ? IconEye : IconPencilMinus,
        onClick: handleEdit,
      },
      {
        name: t('Duplicate'),
        dataQa: 'application-duplicate',
        display: isMyApp,
        Icon: IconCopy,
        onClick: handleDuplicate,
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display:
          isMyApp &&
          isApplicationsSharingEnabled &&
          disabledActions.share !== true,
        Icon: IconUserShare,
        onClick: handleOpenSharing,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display:
          !!entity.sharedWithMe &&
          isApplicationsSharingEnabled &&
          disabledActions.unshare !== true,
        Icon: IconUserShare,
        onClick: handleOpenUnshare,
      },
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
        name: t('Logs'),
        dataQa: 'app-logs',
        display:
          !!isExecutable &&
          playerStatus === SimpleApplicationStatus.UNDEPLOY &&
          disabledActions.logs !== true,
        Icon: IconFileDescription,
        onClick: handleOpenApplicationLogs,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyAppOrPreview && disabledActions.delete !== true,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      disabledActions.copyLink,
      disabledActions.deploy,
      disabledActions.edit,
      disabledActions.share,
      disabledActions.unshare,
      disabledActions.publish,
      disabledActions.unpublish,
      disabledActions.logs,
      disabledActions.delete,
      handleCopy,
      entity,
      playerStatus,
      isExecutable,
      isCodeAppsEnabled,
      handleUpdateFunctionStatus,
      isAppIdPublic,
      canEditOrView,
      handleEdit,
      isMyApp,
      handleDuplicate,
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
