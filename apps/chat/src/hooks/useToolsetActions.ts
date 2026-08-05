import React, { useCallback } from 'react';

import { useRouter } from 'next/router';

import { withEntityIdName } from '@/src/utils/app/application';
import { writeTextToClipboard } from '@/src/utils/app/clipboard';
import { isToolsetSignedIn } from '@/src/utils/app/toolsets';
import { getToolsetLink } from '@/src/utils/marketplace';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import {
  MarketplaceActions,
  PublicationActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';
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
      const link = getToolsetLink(toolset);
      writeTextToClipboard(link, () => {
        dispatch(UIActions.showSuccessToast(t(MarketplaceI18nKeys.LinkCopied)));
      });
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
    [router, toolset.reference, dispatch],
  );

  const handlePublish = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(
        PublicationActions.setPublishModel({
          entity: withEntityIdName(toolset),
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
          entity: withEntityIdName(toolset),
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
      dispatch(MarketplaceActions.setLoginEntity({ toolset }));
    },
    [dispatch, toolset],
  );

  const handleConnect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch(MarketplaceActions.setConnectLinkEntity(toolset));
    },
    [dispatch, toolset],
  );

  const handleRepair = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      dispatch(MarketplaceActions.setRepairEntity(toolset));
    },
    [dispatch, toolset],
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
    handleConnect,
    handleRepair,
  };
};
