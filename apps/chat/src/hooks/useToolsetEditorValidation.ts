import { useEffect, useMemo } from 'react';

import { useRouter } from 'next/router';

import { isMyEntity, isToolsetId } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { PublicationActions, ToolsetActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  PublicationSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';
import { ToolsetEditorQuery } from '@/src/constants/toolsets';

import { UploadStatus } from '@epam/ai-dial-shared';

export const useToolsetEditorValidation = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    [ToolsetEditorQuery.Id]: toolsetRef = '',
    [ToolsetEditorQuery.PublicationUrl]: publicationUrlQuery,
  } = router.query;
  const publicationUrl = publicationUrlQuery
    ? decodeURIComponent(publicationUrlQuery.toString())
    : undefined;
  const isEditing = !!toolsetRef.toString();

  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const areToolsetsLoaded = useAppSelector(
    ToolsetSelectors.selectAreToolsetsLoaded,
  );
  const toolsetDetails = useAppSelector(ToolsetSelectors.selectToolsetDetails);
  const toolsetDetailsStatus = useAppSelector(
    ToolsetSelectors.selectToolsetDetailsStatus,
  );
  const isToolsetDetailsLoading = toolsetDetailsStatus === UploadStatus.LOADING;
  const isToolsetLoadingFailed = toolsetDetailsStatus === UploadStatus.FAILED;

  const publication = useAppSelector((state) =>
    publicationUrl
      ? PublicationSelectors.selectPublicationByUrl(state, publicationUrl)
      : undefined,
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  const reviewToolsetId = useMemo(() => {
    if (publicationUrl && publication?.url === publicationUrl) {
      return publication?.resources?.find((resource) =>
        isToolsetId(resource.reviewUrl),
      )?.reviewUrl;
    }

    return undefined;
  }, [publicationUrl, publication]);

  useEffect(() => {
    if (!isEditing || !areToolsetsLoaded) {
      return;
    }

    if (
      publicationUrl &&
      (publicationUrl !== publication?.url || !publication?.resources)
    ) {
      dispatch(PublicationActions.uploadPublication({ url: publicationUrl }));
      return;
    }

    const toolset = toolsetsMap[toolsetRef.toString()];
    const toolsetId = toolset?.id;
    const isToolsetPublic = toolsetId && isEntityIdPublic({ id: toolsetId });

    if (isAdmin && publicationUrl) {
      if (!toolset && !isToolsetDetailsLoading && reviewToolsetId) {
        dispatch(ToolsetActions.getToolsetDetails({ id: reviewToolsetId }));
      }
      return;
    }

    if (!toolsetId || (!isAdmin && isToolsetPublic)) {
      void router.push(Routes.NotFound);
      return;
    }

    if (
      (!toolsetDetails || !toolsetDetails?.endpoint) &&
      !isToolsetLoadingFailed
    ) {
      dispatch(ToolsetActions.getToolsetDetails({ id: toolsetId }));
    }

    if (
      toolset &&
      !isToolsetPublic &&
      !isMyEntity(toolset) &&
      !canWriteSharedWithMe(toolset)
    ) {
      void router.push(Routes.NotFound);
      return;
    }
  }, [
    areToolsetsLoaded,
    dispatch,
    isAdmin,
    isEditing,
    isToolsetDetailsLoading,
    publication?.resources,
    publication?.url,
    publicationUrl,
    reviewToolsetId,
    router,
    toolsetDetails,
    toolsetRef,
    toolsetsMap,
  ]);
};
