import { EMPTY, catchError, map, of, switchMap } from 'rxjs';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import {
  getIdWithoutRootPathSegments,
  isConversationId,
  isFileId,
} from '@/src/utils/app/id';
import {
  constructPath,
  isMyEntity,
  splitEntityId,
} from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils, parseEntityApiKey } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';

import {
  ApplicationActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { PublicationSelectors } from '@/src/store/selectors';

import { getFolderIdFromEntityId } from '../folders';

import { Message, PublishActions } from '@epam/ai-dial-shared';

export const getSetUpdatedItemsToApproveAction$ = (
  state: RootState,
  oldPublicationResources: PublicationResource[],
  newPublicationResources: PublicationResource[],
  publicationUrl: string,
) => {
  const selectedItemsToApprove =
    PublicationSelectors.selectSelectedPublicationItems(state);

  const previousSourceUrlsPublicationItems = oldPublicationResources
    .filter(({ reviewUrl }) => selectedItemsToApprove.includes(reviewUrl))
    .map(({ sourceUrl }) => sourceUrl ?? '');
  const newSelectedPublicationItems = newPublicationResources.filter(
    ({ sourceUrl }) =>
      sourceUrl && previousSourceUrlsPublicationItems.includes(sourceUrl),
  );

  if (newSelectedPublicationItems.length) {
    return of(
      PublicationActions.setPublicationItems({
        publicationUrl,
        ids: newSelectedPublicationItems.map(({ reviewUrl }) => reviewUrl),
      }),
    );
  }

  return EMPTY;
};

export const addMessageAttachmentsToPublication$ = (
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
        .filter(({ sourceUrl }) =>
          messageAttachmentsToAdd.some(
            (attachment) => attachment.url === sourceUrl,
          ),
        )
        .map(({ reviewUrl }) => ApiUtils.decodeApiUrl(reviewUrl));
      const selectedPublicationItems =
        PublicationSelectors.selectSelectedPublicationItems(state);

      return {
        updatedPublication: response,
        newItemsToSelect: [...selectedPublicationItems, ...newFilesReviewUrls],
      };
    }),
  );
};

export const getUpdateApplicationGeneralInfoAction$ = (
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

export function getPublicationResourceEntityData<T>(
  resources: PublicationResource[],
  uploadedUnpublishIdsSet: Set<string>,
  publicationUrl: string,
  extraFields?: (resource: PublicationResource) => Partial<T>,
): T[] {
  return resources.map((resource) => {
    const { reviewUrl, action } = resource;

    const apiKey = splitEntityId(reviewUrl).name;
    const { name, version, modelInfo } = parseEntityApiKey(apiKey, {
      parseVersion: !isFileId(reviewUrl),
      parseModel: isConversationId(reviewUrl),
    });

    const base = {
      name,
      id: reviewUrl,
      folderId: getFolderIdFromEntityId(reviewUrl),
      publicationInfo: {
        version,
        action,
        isNotExist:
          action === PublishActions.DELETE &&
          !isFileId(reviewUrl) &&
          !uploadedUnpublishIdsSet.has(reviewUrl),
        publicationUrl,
        publishCredentials: resource.publishCredentials,
      },
    };

    const extra = extraFields ? extraFields(resource) : {};

    const modelExtra = modelInfo
      ? {
          model: modelInfo.model,
          isPlayback: modelInfo.isPlayback,
          isReplay: modelInfo.isReplay,
        }
      : {};

    return {
      ...base,
      ...modelExtra,
      ...extra,
    } as T;
  });
}
