import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { isToolsetSignedIn } from '@/src/utils/app/toolsets';
import { getToolsetLink } from '@/src/utils/marketplace';

import {
  ToolsetCredentialsLevel,
  ToolsetEditorSteps,
  ToolsetModel,
} from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import {
  MarketplaceActions,
  PublicationActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { useTranslation } from './useTranslation';

import { PublishActions } from '@epam/ai-dial-shared';

export const useToolsetMenuActions = (toolset: ToolsetModel) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const handleOpenSharing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement toolset sharing
    // dispatch(
    //   ToolsetActions.share({
    //     featureType: FeatureType.Toolset,
    //     entity: entity,
    //   }),
    // );
  }, []);

  const handleOpenUnshare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement toolset unsharing
    // dispatch(ShareActions.setUnshareEntity(entity));
  }, []);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;
      const link = getToolsetLink(toolset);
      navigator.clipboard.writeText(link);
      dispatch(UIActions.showSuccessToast(t('Link copied!')));
    },
    [dispatch, t, toolset],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(ToolsetActions.setToolsetDetails());
      void router.push({
        pathname: Routes.ToolsetEditor,
        query: {
          [ToolsetEditorQuery.Id]: toolset.reference,
          [ToolsetEditorQuery.Step]: ToolsetEditorSteps.Settings,
          [ToolsetEditorQuery.ReturnUrl]:
            window.location.pathname + window.location.search,
        },
      });
    },
    [dispatch, router, toolset.reference],
  );

  const handlePublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        PublicationActions.setPublishModel({
          entity: toolset,
          action: PublishActions.ADD,
          publishCredentials: isToolsetSignedIn(toolset),
        }),
      );
    },
    [dispatch, toolset],
  );

  const handleUnpublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        PublicationActions.setPublishModel({
          entity: toolset,
          action: PublishActions.DELETE,
        }),
      );
    },
    [dispatch, toolset],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        MarketplaceActions.setDeleteEntity({
          entity: toolset,
          action: DeleteType.DELETE,
        }),
      );
    },
    [dispatch, toolset],
  );

  const handleLogin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(MarketplaceActions.setLoginEntity(toolset));
    },
    [dispatch, toolset],
  );

  const handleLogout = useCallback(
    (e: React.MouseEvent, authLevel: ToolsetCredentialsLevel) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        ToolsetActions.logOutToolset({
          authLevel,
          authType: toolset.authSettings.authenticationType,
          toolsetId: toolset.id,
        }),
      );
    },
    [dispatch, toolset.authSettings.authenticationType, toolset.id],
  );

  return {
    handleCopy,
    handleEdit,
    handlePublish,
    handleUnpublish,
    handleDelete,
    handleOpenSharing,
    handleOpenUnshare,
    handleLogin,
    handleLogout,
  };
};
