import { useCallback, useEffect, useMemo } from 'react';

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
    [ToolsetEditorQuery.Id]: toolsetReference = '',
    [ToolsetEditorQuery.PublicationUrl]: publicationUrlQuery,
  } = router.query;
  const publicationUrl = publicationUrlQuery
    ? decodeURIComponent(publicationUrlQuery.toString())
    : undefined;
  const isEditing = !!toolsetReference.toString();

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

  const listingToolset = toolsetsMap[toolsetReference.toString()];
  const listingToolsetId = listingToolset?.id;
  const hasWriteRights = listingToolset && canWriteSharedWithMe(listingToolset);
  const shouldUploadPublication =
    publicationUrl !== publication?.url || !publication?.resources;

  const redirectToNotFound = useCallback(() => {
    void router.push(Routes.NotFound);
  }, [router.push]);

  useEffect(() => {
    if (!isEditing || !areToolsetsLoaded || isToolsetDetailsLoading) {
      return;
    }

    if (publicationUrl && shouldUploadPublication) {
      dispatch(PublicationActions.uploadPublication({ url: publicationUrl }));
      return;
    }

    const isToolsetPublic =
      listingToolsetId && isEntityIdPublic({ id: listingToolsetId });

    if (isAdmin && publicationUrl) {
      if (!listingToolsetId && reviewToolsetId) {
        dispatch(ToolsetActions.getToolsetDetails({ id: reviewToolsetId }));
      }
      return;
    }

    if (!listingToolsetId || (!isAdmin && isToolsetPublic)) {
      console.error(
        'NotFound',
        `toolset is not found or is not public. toolsetId: ${listingToolsetId}, isToolsetPublic: ${isToolsetPublic}`,
      );
      redirectToNotFound();
      return;
    }

    if (!toolsetDetails && !isToolsetLoadingFailed) {
      dispatch(ToolsetActions.getToolsetDetails({ id: listingToolsetId }));
    }

    if (
      listingToolsetId &&
      !isToolsetPublic &&
      !isMyEntity({ id: listingToolsetId }) &&
      !hasWriteRights
    ) {
      console.error(
        'NotFound',
        `toolset is not public or not my toolset or not shared with me. toolset: ${listingToolsetId}, isToolsetPublic: ${isToolsetPublic}, isMyEntity: ${isMyEntity({ id: listingToolsetId })}, canWriteSharedWithMe: ${hasWriteRights}`,
      );
      redirectToNotFound();
      return;
    }
  }, [
    areToolsetsLoaded,
    dispatch,
    isAdmin,
    isEditing,
    isToolsetDetailsLoading,
    isToolsetLoadingFailed,
    shouldUploadPublication,
    publicationUrl,
    reviewToolsetId,
    redirectToNotFound,
    toolsetDetails,
    toolsetReference,
  ]);
};
