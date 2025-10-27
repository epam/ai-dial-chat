import { useCallback } from 'react';

import { isFileId } from '@/src/utils/app/id';
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

  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publication.url),
  );
  const entitiesEditState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );
  const foldersEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );
  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, publication.targetFolder),
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
    ],
  );

  return (
    <PublicationHandler
      onSubmit={handleSubmit}
      rules={rules}
      publication={publication}
    />
  );
}
