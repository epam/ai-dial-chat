import {
  IconFileDescription,
  IconLink,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getApplicationNextStatus,
  getApplicationSimpleStatus,
  getApplicationType,
  getPlayerCaption,
  isApplicationPublic,
  isApplicationStatusUpdating,
  isExecutableApp,
} from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';
import { getApplicationLink } from '@/src/utils/marketplace';

import { SimpleApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  MarketplaceActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import {
  DeleteType,
  PlayerContextIconClasses,
  PlayerContextIcons,
} from '@/src/constants/marketplace';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

export const useApplicationMenuActions = ({
  entity,
  isPreview = false,
}: {
  entity: DialAIEntityModel;
  isPreview?: boolean;
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const isCodeAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeApps),
  );
  const detailedApplicationTypeSchema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const isMyApp = isMyApplication(entity);
  const isPublicApp = isApplicationPublic(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isModifyDisabled = isApplicationStatusUpdating(entity);
  const playerStatus = getApplicationSimpleStatus(entity);
  const hasEditPermissions = isMyApp || canWrite;
  const isExecutable = isExecutableApp(entity) && hasEditPermissions;

  const PlayerContextIcon = PlayerContextIcons[playerStatus];

  const handleUpdateFunctionStatus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: entity.id,
          status: getApplicationNextStatus(entity),
        }),
      );
    },
    [dispatch, entity],
  );

  const handleOpenApplicationLogs = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(MarketplaceActions.setApplicationLogsEntity(entity));
    },
    [entity, dispatch],
  );

  const handleOpenSharing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Application,
          entity: entity,
        }),
      );
    },
    [dispatch, entity],
  );

  const handleOpenUnshare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(ShareActions.setUnshareEntity(entity));
    },
    [dispatch, entity],
  );

  const isApplicationsSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.ApplicationsSharing),
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;
      const link = getApplicationLink(entity);
      navigator.clipboard.writeText(link);
      dispatch(UIActions.showSuccessToast(t('Link copied!')));
    },
    [dispatch, entity, t],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const applicationType = getApplicationType(entity);
      dispatch(
        ApplicationActions.enterEditMode({
          entity: entity,
          applicationType,
          detailedApplicationTypeSchemaId: detailedApplicationTypeSchema?.$id,
        }),
      );
    },
    [entity, dispatch, detailedApplicationTypeSchema?.$id],
  );

  const handlePublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        MarketplaceActions.setPublishModel({
          entity,
          action: PublishActions.ADD,
        }),
      );
    },
    [dispatch, entity],
  );

  const handleUnpublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        MarketplaceActions.setPublishModel({
          entity,
          action: PublishActions.DELETE,
        }),
      );
    },
    [dispatch, entity],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        MarketplaceActions.setDeleteModel({
          entity,
          action: DeleteType.DELETE,
        }),
      );
    },
    [dispatch, entity],
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Copy link'),
        dataQa: 'application-copy-link',
        display: isPublicApp,
        Icon: IconLink,
        onClick: handleCopy,
      },
      {
        name: t(getPlayerCaption(entity)),
        dataQa: 'status-change',
        disabled: playerStatus === SimpleApplicationStatus.UPDATING,
        display: isExecutable && isCodeAppsEnabled && hasEditPermissions,
        Icon: PlayerContextIcon,
        iconClassName: PlayerContextIconClasses[playerStatus],
        onClick: handleUpdateFunctionStatus,
      },
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: hasEditPermissions,
        Icon: IconPencilMinus,
        onClick: handleEdit,
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display: isMyApp && isApplicationsSharingEnabled,
        Icon: IconUserShare,
        onClick: handleOpenSharing,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: !!entity.sharedWithMe && isApplicationsSharingEnabled,
        Icon: IconUserUnshare,
        onClick: handleOpenUnshare,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: isMyApp || isPreview,
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isEntityIdPublic(entity),
        Icon: UnpublishIcon,
        onClick: handleUnpublish,
      },
      {
        name: t('Logs'),
        dataQa: 'app-logs',
        display:
          !!isExecutable && playerStatus === SimpleApplicationStatus.UNDEPLOY,
        Icon: IconFileDescription,
        onClick: handleOpenApplicationLogs,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: isMyApp || isPreview,
        disabled: isModifyDisabled,
        Icon: IconTrashX,
        iconClassName: 'stroke-error',
        onClick: handleDelete,
      },
    ],
    [
      t,
      isPublicApp,
      handleCopy,
      entity,
      playerStatus,
      isExecutable,
      isCodeAppsEnabled,
      PlayerContextIcon,
      handleUpdateFunctionStatus,
      hasEditPermissions,
      handleEdit,
      isMyApp,
      isApplicationsSharingEnabled,
      handleOpenSharing,
      handleOpenUnshare,
      isPreview,
      handlePublish,
      handleUnpublish,
      handleOpenApplicationLogs,
      isModifyDisabled,
      handleDelete,
    ],
  );

  return {
    menuItems,
    actions: {
      handleCopy,
      handleEdit,
      handlePublish,
      handleUnpublish,
      handleDelete,
      handleOpenSharing,
      handleOpenUnshare,
      handleUpdateFunctionStatus,
      handleOpenApplicationLogs,
    },
  };
};
