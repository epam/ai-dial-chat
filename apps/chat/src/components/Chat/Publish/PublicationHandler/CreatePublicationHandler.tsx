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
      _resources: PublicationResource[],
      formData?: PublicationRequestFormData,
    ) => {
      const resources = selectedPublicationItems.map((id) => {
        if (isFileId(id)) {
          return {
            action: publicationModel.action,
            sourceUrl: id,
            targetUrl: constructPath(
              ApiKeys.Files,
              formData?.publishToUrl ?? '',
              ...id.split('/').slice(2),
            ),
          };
        }

        return {
          action: publicationModel.action,
          sourceUrl: id,
          targetUrl:
            publicationModel.action === PublishActions.DELETE
              ? constructPath(
                  id.split('/')[0],
                  formData?.publishToUrl ?? '',
                  ...id.split('/').slice(2),
                )
              : getNewTargetUrlFromEditState(
                  id,
                  entitiesEditState[id],
                  foldersEditState,
                  publication.targetFolder,
                  formData?.publishToUrl ?? '',
                  publicationModel.action,
                ),
          ...(isToolsetId(id) && {
            publishCredentials: selectedPublishCredentials.includes(id),
          }),
        };
      });

      dispatch(
        PublicationActions.publish({
          name: formData?.publishRequestName.trim(),
          resources,
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
