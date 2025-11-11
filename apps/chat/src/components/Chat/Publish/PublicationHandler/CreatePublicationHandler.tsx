import { useCallback } from 'react';

import { isFileId, isToolsetId } from '@/src/utils/app/id';
import { getNewTargetUrlFromEditState } from '@/src/utils/app/publications';
import { constructPath } from '@/src/utils/app/shared-utils';

import { ApiKeys } from '@/src/types/common';
import {
  Publication,
  PublicationModel,
  PublicationResource,
} from '@/src/types/publication';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PublicationRequestFormData } from '../form';
import { PublicationHandler } from './PublicationHandler';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  publication: Publication;
  publicationModel: PublicationModel;
}

export function CreatePublicationHandler({
  publication,
  publicationModel,
}: Props) {
  const dispatch = useAppDispatch();

  const selectedPublishCredentials = useAppSelector((state) =>
    PublicationSelectors.selectSelectedCredentialsItems(state, publication.url),
  );
  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publication.url),
  );
  const entitiesEditState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );
  const foldersEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );

  const handleSubmit = useCallback(
    (
      resources: PublicationResource[],
      formData?: PublicationRequestFormData,
    ) => {
      const mappedResources = resources.map((resource) => {
        if (publicationModel.action === PublishActions.DELETE) {
          return { ...resource, sourceUrl: resource.sourceUrl ?? '' };
        }

        if (isFileId(resource.reviewUrl)) {
          return {
            ...resource,
            sourceUrl: resource.sourceUrl ?? '',
            targetUrl: constructPath(
              ApiKeys.Files,
              formData?.publishToUrl ?? '',
              ...resource.targetUrl.split('/').slice(2),
            ),
          };
        }

        return {
          ...resource,
          sourceUrl: resource.sourceUrl ?? '',
          targetUrl: getNewTargetUrlFromEditState(
            resource.reviewUrl,
            entitiesEditState[resource.reviewUrl],
            foldersEditState,
            publication.targetFolder,
            formData?.publishToUrl ?? '',
            publicationModel.action,
          ),
          ...(isToolsetId(resource.reviewUrl) && {
            publishCredentials: selectedPublishCredentials.includes(
              resource.reviewUrl,
            ),
          }),
        };
      });

      dispatch(
        PublicationActions.publish({
          name: formData?.publishRequestName.trim(),
          resources: mappedResources.filter((resource) =>
            selectedPublicationItems.includes(resource.reviewUrl),
          ),
          targetFolder: formData?.publishToUrl ?? '',
          displayAuthor: formData?.publicationAuthor?.trim() ?? '',
          rules: formData?.rules ?? [],
        }),
      );
      dispatch(PublicationActions.setPublishModel());
    },
    [
      dispatch,
      entitiesEditState,
      foldersEditState,
      publication.targetFolder,
      publicationModel.action,
      selectedPublicationItems,
      selectedPublishCredentials,
    ],
  );

  return (
    <PublicationHandler onSubmit={handleSubmit} publication={publication} />
  );
}
