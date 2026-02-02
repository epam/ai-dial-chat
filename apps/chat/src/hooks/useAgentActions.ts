import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { getApplicationType } from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getApplicationLink } from '@/src/utils/marketplace';

import { ApplicationStatus } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  MarketplaceActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationTypesSchemasSelectors } from '@/src/store/selectors';

import { DeleteType } from '@/src/constants/marketplace';

import { useApplicationStatusActions } from './useApplicationStatusActions';

import { PublishActions } from '@epam/ai-dial-shared';

export const useAgentMenuActions = (entity: DialAIEntityModel) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const { handleDeploy, handleRedeploy, handleUndeploy } =
    useApplicationStatusActions(entity.id);

  const detailedApplicationTypeSchema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

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
        PublicationActions.setPublishModel({
          entity: { ...entity, folderId: getFolderIdFromEntityId(entity.id) },
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
          entity: { ...entity, folderId: getFolderIdFromEntityId(entity.id) },
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
  };
};
