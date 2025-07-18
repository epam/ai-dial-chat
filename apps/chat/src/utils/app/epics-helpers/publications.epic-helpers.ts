import { EMPTY, map, of } from 'rxjs';

import { PublicationService } from '@/src/utils/app/data/publication-service';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { constructPath, isMyEntity } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import { PublicationActions } from '@/src/store/actions';
import { PublicationSelectors } from '@/src/store/selectors';

import { FeatureType, Message, PublishActions } from '@epam/ai-dial-shared';

export const getSetUpdatedItemsToApproveAction = (
  state: RootState,
  oldPublicationResources: PublicationResource[],
  newPublicationResources: PublicationResource[],
  publicationUrl: string,
) => {
  const selectedItemsToApprove =
    PublicationSelectors.selectSelectedItemsToApprove(state);

  const previousSourceUrlsToApprove = oldPublicationResources
    .filter((resource) => selectedItemsToApprove.includes(resource.reviewUrl))
    .map((resource) => resource.sourceUrl ?? '');
  const newSelectedItemsToApprove = newPublicationResources.filter(
    (resource) =>
      resource.sourceUrl &&
      previousSourceUrlsToApprove.includes(resource.sourceUrl),
  );

  if (newSelectedItemsToApprove.length) {
    return of(
      PublicationActions.setItemsToApprove({
        publicationUrl,
        ids: newSelectedItemsToApprove.map((resource) => resource.reviewUrl),
      }),
    );
  }

  return EMPTY;
};

export const addMessageAttachmentsToPublication = (
  message: Message,
  conversationFolderId: string,
  publicationUrl: string,
  state: RootState,
) => {
  const publication = PublicationSelectors.selectPublicationByUrl(
    state,
    publicationUrl,
  );

  if (!publication) {
    console.error('Publication not found, cannot update attachments');

    return EMPTY;
  }

  const messageAttachments = message.custom_content?.attachments ?? [];
  const messageAttachmentsToAdd = messageAttachments.filter((attachment) =>
    isMyEntity({ id: attachment.url ?? '' }, FeatureType.File),
  );

  const publicationResources = (publication.resources ?? []).map(
    (resource) => ({
      action: resource.action,
      sourceUrl: resource.sourceUrl ?? '',
      targetUrl: resource.targetUrl,
    }),
  );

  messageAttachmentsToAdd.forEach(({ url }) => {
    if (url) {
      publicationResources.push({
        action: PublishActions.ADD_IF_ABSENT,
        sourceUrl: ApiUtils.decodeApiUrl(url),
        targetUrl: ApiUtils.decodeApiUrl(
          constructPath(
            url.split('/')[0],
            publication.targetFolder,
            getIdWithoutRootPathSegments(conversationFolderId),
            url.split('/').at(-1),
          ),
        ),
      });
    }
  });

  return PublicationService.updatePublicationRequest({
    publicationData: {
      ...publication,
      resources: publicationResources,
    },
    url: publicationUrl,
  }).pipe(
    map((response) => {
      const newFilesReviewUrls = response.resources
        .filter((resource) =>
          messageAttachmentsToAdd.some(
            (attachment) => attachment.url === resource.sourceUrl,
          ),
        )
        .map((resource) => ApiUtils.decodeApiUrl(resource.reviewUrl));
      const selectedItemsToApprove =
        PublicationSelectors.selectSelectedItemsToApprove(state);

      return {
        updatedPublication: response,
        newItemsToSelect: [...selectedItemsToApprove, ...newFilesReviewUrls],
      };
    }),
  );
};
