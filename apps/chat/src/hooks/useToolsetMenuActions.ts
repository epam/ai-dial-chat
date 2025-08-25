import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { ToolsetModel } from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { Routes } from '@/src/constants/routes';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      dispatch(ToolsetActions.getToolsetDetails({ id: toolset.id }));
      void router.push(Routes.ToolsetEditor);
    },
    [dispatch, router, toolset.id],
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

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement toolset deleting
    // dispatch(
    //   MarketplaceActions.setDeleteModel({
    //     entity,
    //     action: DeleteType.DELETE,
    //   }),
    // );
  }, []);

  return {
    handleCopy,
    handleEdit,
    handlePublish,
    handleUnpublish,
    handleDelete,
    handleOpenSharing,
    handleOpenUnshare,
  };
};
