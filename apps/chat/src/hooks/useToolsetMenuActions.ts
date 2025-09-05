import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { ToolsetEditorSteps, ToolsetModel } from '@/src/types/toolsets';

import { MarketplaceActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { DeleteType } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

export const useToolsetMenuActions = (toolset: ToolsetModel) => {
  // const { t } = useTranslation(Translation.Marketplace);

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

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement toolset copying
    // if (!navigator.clipboard) return;
    // const link = getApplicationLink(entity);
    // navigator.clipboard.writeText(link);
    // dispatch(UIActions.showSuccessToast(t('Link copied!')));
  }, []);

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
        },
      });
    },
    [dispatch, router, toolset.reference],
  );

  const handlePublish = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement toolset publishing
    // dispatch(
    //   PublicationActions.setPublishModel({
    //     entity,
    //     action: PublishActions.ADD,
    //   }),
    // );
  }, []);

  const handleUnpublish = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement toolset unpublishing
    // dispatch(
    //   PublicationActions.setPublishModel({
    //     entity,
    //     action: PublishActions.DELETE,
    //   }),
    // );
  }, []);

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

  return {
    handleCopy,
    handleEdit,
    handlePublish,
    handleUnpublish,
    handleDelete,
    handleOpenSharing,
    handleOpenUnshare,
    handleLogin,
  };
};
