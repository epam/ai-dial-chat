import { useCallback, useEffect } from 'react';

import { getIdWithoutFeatureType } from '@/src/utils/app/id';
import { getNewTargetUrlFromEditState } from '@/src/utils/app/publications';

import { Publication, PublicationResource } from '@/src/types/publication';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { PublicationHandler } from './PublicationHandler';

interface Props {
  publication: Publication;
}

export function ReviewPublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const editedPublishToUrl = useAppSelector(
    PublicationSelectors.selectPublishToUrl,
  );
  const rulesOnEdit = useAppSelector(PublicationSelectors.selectRulesOnEdit);
  const displayAuthorEditState = useAppSelector(
    PublicationSelectors.selectDisplayAuthorEditState,
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
    (resources: PublicationResource[]) => {
      const mappedResources = resources.map((resource) => ({
        ...resource,
        sourceUrl: resource.sourceUrl ?? '',
        targetUrl: getNewTargetUrlFromEditState(
          resource.reviewUrl,
          entitiesEditState[resource.reviewUrl],
          foldersEditState,
          publication.targetFolder,
          editedPublishToUrl,
          resource.action,
        ),
      }));

      dispatch(
        PublicationActions.updatePublicationRequest({
          url: publication.url,
          dataToUpdate: {
            targetFolder: editedPublishToUrl,
            rules: rulesOnEdit,
            displayAuthor: displayAuthorEditState.trim(),
            resources: mappedResources,
          },
        }),
      );
      dispatch(PublicationActions.setIsEditMode(false));
    },
    [
      dispatch,
      displayAuthorEditState,
      editedPublishToUrl,
      entitiesEditState,
      foldersEditState,
      publication.targetFolder,
      publication.url,
      rulesOnEdit,
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
