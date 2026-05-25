import { NextRouter } from 'next/router';

import { EMPTY, catchError, map, of, switchMap } from 'rxjs';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';
import {
  getEntityBucket,
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
import { MarketplaceEditorSteps } from '@/src/types/marketplace';
import { PublicationResource } from '@/src/types/publication';
import { RootState } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import {
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { getFolderIdFromEntityId } from '../folders';

import { Message, PublishActions } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

export const getDeletedEntities = <
  T extends { id: string; publicationInfo?: unknown },
>(
  entities: T[],
  resourcesToDelete: Set<string>,
) =>
  entities
    .filter((entity) => resourcesToDelete.has(entity.id))
    .map((entity) => ({
      ...entity,
      publicationInfo: {
        ...(entity.publicationInfo || {}),
        action: PublishActions.DELETE,
      },
    }));

export const getSetUpdatedItemsToApproveAction$ = (
  state: RootState,
  oldPublicationResources: PublicationResource[],
  newPublicationResources: PublicationResource[],
  publicationUrl: string,
) => {
  const selectedItemsToApprove =
    PublicationSelectors.selectSelectedPublicationItems(state, publicationUrl);

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
        PublicationSelectors.selectSelectedPublicationItems(
          state,
          publicationUrl,
        );

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
  isSaveAndExit?: boolean,
  tabToOpen?: MarketplaceEditorSteps,
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

      const shaderUpdatePayload = {
        oldApplication,
        applicationData,
        isSaveAndExit,
        tabToOpen,
      };

      if (newApplication.applicationTypeSchemaId) {
        return ApplicationTypesSchemasService.getApplicationTypeSchema(
          newApplication.applicationTypeSchemaId,
        ).pipe(
          switchMap((schema) => {
            return of(
              ApplicationActions.update({
                ...shaderUpdatePayload,
                schema,
              }),
            );
          }),
          catchError((err) => {
            console.error(err);
            const { traceId } = parseApiError(err);
            return of(
              UIActions.showErrorToast({
                message: translate(
                  CommonI18nKeys.CannotFetchApplicationSchema,
                  {
                    ns: Translation.Common,
                  },
                ),
                traceId,
              }),
            );
          }),
        );
      }

      return of(ApplicationActions.update(shaderUpdatePayload));
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

export const getCurrentReviewBucket = (
  state: RootState,
  router: NextRouter,
) => {
  const queryPublicationUrl = router.query.publicationUrl?.toString();
  const storePublicationUrl =
    PublicationSelectors.selectSelectedPublicationUrl(state);
  const publicationUrl = queryPublicationUrl || storePublicationUrl;
  const publication = publicationUrl
    ? PublicationSelectors.selectPublicationByUrl(state, publicationUrl)
    : undefined;
  const selectedConversations =
    ConversationsSelectors.selectSelectedConversations(state);

  if (!publication) return undefined;

  const areAllReviewConversations =
    selectedConversations.length &&
    selectedConversations.every((c) => !!c.publicationInfo?.publicationUrl);
  const buckets = selectedConversations.map(getEntityBucket);
  const areBucketsSame = uniq(buckets).length === 1;
  const areAllSamePublicationConversations =
    areAllReviewConversations && areBucketsSame;
  const publicationResources = publication?.resources ?? [];
  const firstReviewUrl = publicationResources[0]?.reviewUrl;

  if (!publicationResources.length && !areAllSamePublicationConversations) {
    return undefined;
  }
  return firstReviewUrl ? getEntityBucket({ id: firstReviewUrl }) : buckets[0];
};
