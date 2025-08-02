import { EMPTY, catchError, map, of, switchMap } from 'rxjs';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { constructPath, isMyEntity } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import {
  ApplicationActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { PublicationSelectors } from '@/src/store/selectors';

import { Message, PublishActions } from '@epam/ai-dial-shared';

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
    isMyEntity({ id: attachment.url ?? '' }),
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
      const splittedUrl = url.split('/');
      publicationResources.push({
        action: PublishActions.ADD_IF_ABSENT,
        sourceUrl: ApiUtils.decodeApiUrl(url),
        targetUrl: ApiUtils.decodeApiUrl(
          constructPath(
            splittedUrl[0],
            publication.targetFolder,
            getIdWithoutRootPathSegments(conversationFolderId),
            splittedUrl.at(-1),
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

export const getUpdateApplicationGeneralInfoAction = (
  oldApplication: CustomApplicationModel,
  newApplication: CustomApplicationModel,
) => {
  return ApplicationService.get(newApplication.id).pipe(
    switchMap((application) => {
      const applicationData = newApplication;

      // function and applicationProperties could be updated by core automatically, if id was changed
      if (application?.function) {
        applicationData.function = application.function;
      } else if (application?.applicationProperties) {
        applicationData.applicationProperties =
          application.applicationProperties;
      }

      if (newApplication.applicationTypeSchemaId) {
        return ApplicationTypesSchemasService.getApplicationTypeSchema(
          newApplication.applicationTypeSchemaId,
        ).pipe(
          switchMap((schema) => {
            return of(
              ApplicationActions.update({
                oldApplication,
                applicationData,
                schema,
              }),
            );
          }),
          catchError((err) => {
            console.error(err);
            return of(
              UIActions.showErrorToast(
                translate(
                  'Cannot fetch application schema. Please try again later.',
                ),
              ),
            );
          }),
        );
      }

      return of(
        ApplicationActions.update({
          oldApplication,
          applicationData,
        }),
      );
    }),
  );
};
