import { useCallback, useEffect } from 'react';

import { getIdWithoutFeatureType } from '@/src/utils/app/id';
import { getNewTargetUrlFromEditState } from '@/src/utils/app/publications';

import { Publication, PublicationResource } from '@/src/types/publication';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { PublicationRequestFormData } from '../form';
import { PublicationHandler } from './PublicationHandler';

interface Props {
  publication: Publication;
}

export function ReviewPublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const entitiesEditState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );
  const foldersEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );

  useEffect(() => {
    if (publication.targetFolder !== PUBLIC_URL_PREFIX) {
      dispatch(
        PublicationActions.uploadRules({
          path: getIdWithoutFeatureType(publication.targetFolder),
        }),
      );
    }
  }, [dispatch, publication.targetFolder]);

  const handleSubmit = useCallback(
    (
      resources: PublicationResource[],
      formData?: PublicationRequestFormData,
    ) => {
      const mappedResources = resources.map((resource) => ({
        ...resource,
        sourceUrl: resource.sourceUrl ?? '',
        targetUrl: getNewTargetUrlFromEditState(
          resource.reviewUrl,
          entitiesEditState[resource.reviewUrl],
          foldersEditState,
          publication.targetFolder,
          formData?.publishToUrl ?? '',
          resource.action,
        ),
      }));

      dispatch(
        PublicationActions.updatePublicationRequest({
          url: publication.url,
          dataToUpdate: {
            targetFolder: formData?.publishToUrl ?? '',
            rules: formData?.rules ?? [],
            displayAuthor: formData?.publicationAuthor?.trim() ?? '',
            resources: mappedResources,
          },
        }),
      );
      dispatch(PublicationActions.setIsEditMode(false));
    },
    [
      dispatch,
      entitiesEditState,
      foldersEditState,
      publication.targetFolder,
      publication.url,
    ],
  );

  return (
    <PublicationHandler onSubmit={handleSubmit} publication={publication} />
  );
}
