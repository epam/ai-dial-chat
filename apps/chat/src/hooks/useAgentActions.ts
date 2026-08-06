import React, { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { getApplicationType } from '@/src/utils/app/application';
import { writeTextToClipboard } from '@/src/utils/app/clipboard';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { withEntityIdName } from '@/src/utils/app/marketplace-localization';
import { getApplicationLink } from '@/src/utils/marketplace';

import { ApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  MarketplaceActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { DeleteType } from '@/src/constants/marketplace';

import { useApplicationStatusActions } from './useApplicationStatusActions';

import { PublishActions } from '@epam/ai-dial-shared';

export const useAgentMenuActions = (entity: DialAIEntityModel) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const { handleDeploy, handleRedeploy, handleUndeploy } =
    useApplicationStatusActions(entity.id);

  const handleRedeployWrapper = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleRedeploy();
    },
    [handleRedeploy],
  );

  const handleUpdateFunctionStatus = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (entity.functionStatus === ApplicationStatus.DEPLOYED) {
        handleUndeploy();
      } else {
        handleDeploy();
      }
    },
    [entity.functionStatus, handleDeploy, handleUndeploy],
  );

  const handleOpenApplicationLogs = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(ApplicationActions.setLogsEntityId(entity.id));
    },
    [entity, dispatch],
  );

  const handleOpenSharing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(
        ShareActions.share({
          featureType: FeatureType.Application,
          entity: withEntityIdName(entity),
        }),
      );
    },
    [dispatch, entity],
  );

  const handleOpenUnshare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(ShareActions.setUnshareEntity(withEntityIdName(entity)));
    },
    [dispatch, entity],
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const link = getApplicationLink(entity);
      writeTextToClipboard(link, () => {
        dispatch(UIActions.showSuccessToast(t(MarketplaceI18nKeys.LinkCopied)));
      });
    },
    [dispatch, entity, t],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const applicationType = getApplicationType(entity);
      dispatch(ApplicationActions.setAppDetails());
      dispatch(
        ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
      );
      dispatch(
        ApplicationActions.enterEditMode({
          entity,
          applicationType,
        }),
      );
    },
    [entity, dispatch],
  );

  const handlePublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        PublicationActions.setPublishModel({
          entity: {
            ...withEntityIdName(entity),
            folderId: getFolderIdFromEntityId(entity.id),
          },
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
        PublicationActions.setPublishModel({
          entity: {
            ...withEntityIdName(entity),
            folderId: getFolderIdFromEntityId(entity.id),
          },
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
        MarketplaceActions.setDeleteEntity({
          entity,
          action: DeleteType.DELETE,
        }),
      );
    },
    [dispatch, entity],
  );

  const handleConnect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(MarketplaceActions.setConnectLinkEntity(entity));
    },
    [dispatch, entity],
  );

  return {
    handleCopy,
    handleEdit,
    handlePublish,
    handleUnpublish,
    handleDelete,
    handleOpenSharing,
    handleOpenUnshare,
    handleUpdateFunctionStatus,
    handleOpenApplicationLogs,
    handleRedeploy: handleRedeployWrapper,
    handleConnect,
  };
};
