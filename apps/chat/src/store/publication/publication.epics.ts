import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  forkJoin,
  from,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  toArray,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { getLastPathSegment } from '@/src/utils/app/common';
import {
  getConversationInfoFromId,
  updateAttachmentTitles,
} from '@/src/utils/app/conversation';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import { constructPath } from '@/src/utils/app/file';
import {
  getFolderFromId,
  getFolderIdFromEntityId,
  getFoldersFromIds,
  getParentFolderIdsFromEntityId,
  getParentFolderIdsFromFolderId,
  getRootFolderIdFromEntityId,
} from '@/src/utils/app/folders';
import {
  filterIdsByFeatureType,
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
  isRootId,
} from '@/src/utils/app/id';
import { getPromptInfoFromId } from '@/src/utils/app/prompts';
import {
  getFilesFromPublicResources,
  getItemsIdsToRemoveAndHide,
  isEntityIdPublic,
  mapPublishedItems,
  processPublicationResources,
} from '@/src/utils/app/publications';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import {
  ApiUtils,
  getIdWithoutVersionFromApiKey,
  getVersionFromId,
  parseApplicationApiKey,
  parseConversationApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType, FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import {
  PublicationUpdateRequestModel,
  PublishedFileItem,
} from '@/src/types/publication';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ApplicationActions,
  ConversationsActions,
  FilesActions,
  ModelsActions,
  PromptsActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import {
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PromptsSelectors,
  PublicationSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';

import {
  Conversation,
  ConversationInfo,
  Feature,
  Prompt,
  PublishActions,
  UploadStatus,
} from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.init.type),
    filter(() => !PublicationSelectors.selectInitialized(state$.value)),
    switchMap(() => {
      const actions: Observable<AppAction>[] = [];

      const isAdmin = AuthSelectors.selectIsAdmin(state$.value);

      if (isAdmin) {
        actions.push(of(PublicationActions.uploadPublications()));
      }

      return concat(
        ...actions,
        of(
          PublicationActions.uploadAllPublishedWithMeItems({
            featureType: FeatureType.Chat,
          }),
        ),
        of(
          PublicationActions.uploadAllPublishedWithMeItems({
            featureType: FeatureType.Prompt,
          }),
        ),
        of(PublicationActions.initFinish()),
      );
    }),
  );

const publishEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.publish.type),
    switchMap(({ payload }) => processPublicationResources(payload)),
    switchMap(({ publicationData, isPublishingExternalFiles }) => {
      if (isPublishingExternalFiles) {
        return of(
          PublicationActions.publishFail(
            errorsMessages.publicationWithExternalFilesFailed,
          ),
        );
      }

      return PublicationService.createPublicationRequest({
        ...publicationData,
      }).pipe(
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.publishFail(err.message));
        }),
      );
    }),
  );

const publishFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.publishFail.type),
    map(({ payload }) => {
      return UIActions.showErrorToast(
        translate(payload ?? errorsMessages.publicationFailed),
      );
    }),
  );

const uploadPublicationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublications.type),
    filter(() => {
      const enabledFeatures = SettingsSelectors.selectEnabledFeatures(
        state$.value,
      );
      const featuresToCheck = [
        Feature.CustomApplications,
        Feature.ConversationsPublishing,
        Feature.PromptsPublishing,
      ];

      return featuresToCheck.some((feature) => enabledFeatures.has(feature));
    }),
    switchMap(() =>
      PublicationService.publicationList().pipe(
        switchMap((publications) =>
          of(PublicationActions.uploadPublicationsSuccess({ publications })),
        ),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublicationsFail());
        }),
      ),
    ),
  );

const uploadPublicationsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublicationsFail.type),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationsUploadFailed),
      ),
    ),
  );

const uploadPublicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublication.type),
    switchMap(({ payload }) =>
      PublicationService.getPublication(payload.url).pipe(
        switchMap((publication) => {
          const unpublishResources = publication.resources.filter(
            (r) => r.action === PublishActions.DELETE,
          );

          if (unpublishResources.length) {
            const rootFolderPaths = uniq(
              unpublishResources.map((r) =>
                getRootFolderIdFromEntityId(r.reviewUrl),
              ),
            );

            return forkJoin({
              unpublishResources: of(unpublishResources),
              publication: of(publication),
              uploadedUnpublishEntities: from(rootFolderPaths).pipe(
                mergeMap((path) =>
                  isConversationId(path)
                    ? ConversationService.getConversations(
                        path,
                        !isRootId(path),
                      )
                    : PromptService.getPrompts(path, !isRootId(path)),
                ),
                toArray(),
                map((data) => data.flatMap((data) => data)),
              ),
            });
          }

          return of({
            publication: publication,
            uploadedUnpublishEntities: [],
            unpublishResources: [],
          });
        }),
        switchMap(
          ({ publication, uploadedUnpublishEntities, unpublishResources }) => {
            const actions: Observable<AppAction>[] = [];

            if (unpublishResources.length) {
              const uploadedUnpublishEntitiesIds =
                uploadedUnpublishEntities.map((e) => e.id);

              const conversationUnpublishEntities = unpublishResources.filter(
                (r) => isConversationId(r.reviewUrl),
              );
              const conversationPaths = uniq(
                conversationUnpublishEntities.flatMap((resource) =>
                  getParentFolderIdsFromEntityId(
                    getFolderIdFromEntityId(resource.reviewUrl),
                  ).filter((id) => id !== resource.reviewUrl),
                ),
              );

              if (conversationUnpublishEntities.length) {
                actions.push(
                  of(
                    ConversationsActions.addConversations({
                      conversations: conversationUnpublishEntities.map((r) => {
                        const parsedApiKey = parseConversationApiKey(
                          splitEntityId(r.targetUrl).name,
                          { parseVersion: true },
                        );

                        return {
                          ...parsedApiKey,
                          id: r.reviewUrl,
                          folderId: getFolderIdFromEntityId(r.reviewUrl),
                          publicationInfo: {
                            ...parsedApiKey.publicationInfo,
                            action: r.action,
                            isNotExist: !uploadedUnpublishEntitiesIds.includes(
                              r.reviewUrl,
                            ),
                            publicationUrl: payload.url,
                          },
                        };
                      }),
                    }),
                  ),
                  of(
                    ConversationsActions.addFolders({
                      folders: conversationPaths.map((path) => ({
                        ...getFolderFromId(path, FeatureType.Chat),
                        status: UploadStatus.LOADED,
                      })),
                    }),
                  ),
                );
              }

              const promptUnpublishEntities = unpublishResources.filter((r) =>
                isPromptId(r.reviewUrl),
              );
              const promptPaths = uniq(
                promptUnpublishEntities.flatMap((resource) =>
                  getParentFolderIdsFromEntityId(
                    getFolderIdFromEntityId(resource.reviewUrl),
                  ).filter((id) => id !== resource.reviewUrl),
                ),
              );

              if (promptUnpublishEntities.length) {
                actions.push(
                  of(
                    PromptsActions.addPrompts({
                      prompts: promptUnpublishEntities.map((r) => {
                        const parsedApiKey = parsePromptApiKey(
                          splitEntityId(r.targetUrl).name,
                          { parseVersion: true },
                        );

                        return {
                          id: r.reviewUrl,
                          folderId: getFolderIdFromEntityId(r.reviewUrl),
                          name: parsedApiKey.name,
                          publicationInfo: {
                            ...parsedApiKey.publicationInfo,
                            action: r.action,
                            isNotExist: !uploadedUnpublishEntitiesIds.includes(
                              r.reviewUrl,
                            ),
                            publicationUrl: payload.url,
                          },
                        };
                      }),
                    }),
                  ),
                  of(
                    PromptsActions.addFolders({
                      folders: promptPaths.map((path) => ({
                        ...getFolderFromId(path, FeatureType.Prompt),
                        status: UploadStatus.LOADED,
                      })),
                    }),
                  ),
                );
              }
            }

            const promptResources = publication.resources.filter((r) =>
              isPromptId(r.targetUrl),
            );

            if (promptResources.length) {
              const promptPaths = uniq(
                promptResources.flatMap((resource) =>
                  getParentFolderIdsFromEntityId(
                    getFolderIdFromEntityId(resource.reviewUrl),
                  ).filter((id) => id !== resource.reviewUrl),
                ),
              );

              actions.push(
                of(
                  PromptsActions.addFolders({
                    folders: promptPaths.map((path) => ({
                      ...getFolderFromId(path, FeatureType.Prompt),
                      status: UploadStatus.LOADED,
                      isPublicationFolder: true,
                    })),
                  }),
                ),
                of(
                  PromptsActions.addPrompts({
                    prompts: promptResources.map((r) => {
                      const parsedApiKey = parsePromptApiKey(
                        splitEntityId(r.targetUrl).name,
                        { parseVersion: true },
                      );

                      return {
                        id: r.reviewUrl,
                        folderId: getFolderIdFromEntityId(r.reviewUrl),
                        name: parsedApiKey.name,
                        publicationInfo: {
                          ...parsedApiKey.publicationInfo,
                          action: r.action,
                          publicationUrl: payload.url,
                        },
                      };
                    }),
                  }),
                ),
              );
            }

            const applicationResources = publication.resources.filter((r) =>
              isApplicationId(r.targetUrl),
            );

            if (applicationResources.length) {
              const allModels = ModelsSelectors.selectModels(state$.value);

              actions.push(
                of(
                  ModelsActions.addPublishRequestModels({
                    models: applicationResources.map((r) => {
                      const parsedApiKey = parsePromptApiKey(
                        splitEntityId(r.targetUrl).name,
                        { parseVersion: true },
                      );

                      return {
                        id: r.reviewUrl,
                        name: parsedApiKey.name,
                        isDefault: false,
                        reference: r.reviewUrl,
                        type: EntityType.Application,
                        folderId: getFolderIdFromEntityId(r.reviewUrl),
                        publicationInfo: {
                          action: r.action,
                          isNotExist:
                            r.action === PublishActions.DELETE &&
                            !allModels.some(
                              (model) => model.id === r.reviewUrl,
                            ),
                          publicationUrl: payload.url,
                        },
                        owner: r.author ?? 'Unknown',
                      };
                    }),
                  }),
                ),
              );
            }

            const conversationResources = publication.resources.filter((r) =>
              isConversationId(r.targetUrl),
            );

            if (conversationResources.length) {
              const conversationPaths = uniq(
                conversationResources.flatMap((resource) =>
                  getParentFolderIdsFromEntityId(
                    getFolderIdFromEntityId(resource.reviewUrl),
                  ).filter((id) => id !== resource.reviewUrl),
                ),
              );

              actions.push(
                of(
                  ConversationsActions.addFolders({
                    folders: conversationPaths.map((path) => ({
                      ...getFolderFromId(path, FeatureType.Chat),
                      status: UploadStatus.LOADED,
                      isPublicationFolder: true,
                    })),
                  }),
                ),
                of(
                  ConversationsActions.addConversations({
                    conversations: conversationResources.map((r) => {
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(r.targetUrl).name,
                        { parseVersion: true },
                      );

                      return {
                        ...parsedApiKey,
                        id: r.reviewUrl,
                        folderId: getFolderIdFromEntityId(r.reviewUrl),
                        publicationInfo: {
                          ...parsedApiKey.publicationInfo,
                          action: r.action,
                          publicationUrl: payload.url,
                        },
                      };
                    }),
                  }),
                ),
              );
            }

            const fileResources = publication.resources.filter((r) =>
              isFileId(r.targetUrl),
            );

            if (fileResources.length) {
              const filePaths = uniq(
                fileResources.flatMap((resource) =>
                  getParentFolderIdsFromEntityId(
                    getFolderIdFromEntityId(resource.reviewUrl),
                  ).filter((id) => id !== resource.reviewUrl),
                ),
              );

              const { publicFiles, foldersSet } = getFilesFromPublicResources({
                fileResources,
                payloadUrl: payload.url,
              });

              actions.push(
                of(
                  FilesActions.getFoldersSuccess({
                    folders: filePaths.map((path) => ({
                      ...getFolderFromId(path, FeatureType.File),
                      status: UploadStatus.LOADED,
                      isPublicationFolder: true,
                    })),
                  }),
                ),
                of(
                  FilesActions.getFilesSuccess({
                    files: publicFiles,
                    foldersSet: foldersSet,
                  }),
                ),
              );
            }

            // we do not need to review files

            const existingReviewedResources =
              PublicationSelectors.selectResourcesToReviewByPublicationUrl(
                state$.value,
                publication.url,
              );

            const resourcesToReview = publication.resources.filter(
              (resource) => !isFileId(resource.targetUrl),
            );

            const resourcesToReviewIds = resourcesToReview.map(
              (resource) => resource.reviewUrl,
            );
            const uploadedUnpublishEntitiesToReview =
              uploadedUnpublishEntities.filter((entity) =>
                resourcesToReviewIds.includes(entity.id),
              );

            return concat(
              iif(
                () =>
                  uploadedUnpublishEntitiesToReview.length ===
                  unpublishResources.length,
                of(
                  PublicationActions.setPublicationsToReview({
                    items: resourcesToReview.map((resource) => {
                      const matched = existingReviewedResources.find(
                        (r) => r.sourceUrl === resource.sourceUrl,
                      );

                      return {
                        reviewed: matched?.reviewed ?? false,
                        reviewUrl: resource.reviewUrl,
                        sourceUrl: resource.sourceUrl!,
                      };
                    }),
                    publicationUrl: publication.url,
                  }),
                ),
                EMPTY,
              ),
              of(
                PublicationActions.uploadPublicationSuccess({
                  publication: {
                    ...publication,
                    resources: publication.resources,
                    uploadStatus: UploadStatus.LOADED,
                  },
                }),
              ),
              of(PublicationActions.selectPublication(publication.url)),
              ...actions,
            );
          },
        ),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublicationFail());
        }),
      ),
    ),
  );

const uploadPublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublicationsFail.type),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationUploadFailed),
      ),
    ),
  );

const uploadPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublishedWithMeItems.type),
    filter(({ payload }) =>
      SettingsSelectors.selectIsPublishingEnabled(
        state$.value,
        payload.featureType,
      ),
    ),
    mergeMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        mergeMap(({ folders, items }) => {
          const actions: Observable<AppAction>[] = [];

          const selectedIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const selectedConversationsToUpload = selectedIds.filter(
            // do not upload root entities, as they uploaded with listing
            (id) => id.split('/').length > 3 && isEntityIdPublic({ id }),
          );
          const publicationItems = items.map((item) => ({
            ...item,
            id: item.url,
            updatedAt: Date.now(),
          }));

          if (selectedConversationsToUpload.length) {
            const rootFolderIds = uniq(
              selectedConversationsToUpload.map((id) =>
                getRootFolderIdFromEntityId(id),
              ),
            );

            rootFolderIds.forEach((id) =>
              actions.push(
                of(
                  ConversationsActions.uploadConversationsWithFoldersRecursive({
                    path: id,
                    noLoader: true,
                  }),
                ),
              ),
            );
          }

          if (!folders.length && !items.length) {
            return EMPTY;
          }

          if (payload.featureType === FeatureType.Chat) {
            if (folders.length) {
              actions.push(
                of(
                  ConversationsActions.addFolders({
                    folders: folders.map((folder) => ({
                      name: folder.name,
                      id: folder.url,
                      folderId: getFolderIdFromEntityId(folder.url),
                      publishedWithMe: true,
                      type: FeatureType.Chat,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              const { publicVersionGroups, items: conversations } =
                mapPublishedItems<ConversationInfo>(
                  publicationItems.map((item) => ({
                    ...item,
                    updatedAt: item.updatedAt,
                  })),
                  payload.featureType,
                );

              actions.push(
                of(
                  PublicationActions.addPublicVersionGroups({
                    publicVersionGroups,
                  }),
                ),
                of(
                  ConversationsActions.addConversations({
                    conversations,
                  }),
                ),
              );
            }
          } else if (payload.featureType === FeatureType.Prompt) {
            if (folders.length) {
              actions.push(
                of(
                  PromptsActions.addFolders({
                    folders: folders.map((folder) => ({
                      name: folder.name,
                      id: folder.url,
                      folderId: getFolderIdFromEntityId(folder.url),
                      publishedWithMe: true,
                      type: FeatureType.Prompt,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              const { publicVersionGroups, items: prompts } =
                mapPublishedItems<PromptInfo>(
                  publicationItems,
                  payload.featureType,
                );

              actions.push(
                of(
                  PublicationActions.addPublicVersionGroups({
                    publicVersionGroups,
                  }),
                ),
                of(
                  PromptsActions.addPrompts({
                    prompts,
                  }),
                ),
              );
            }
          } else if (payload.featureType === FeatureType.File) {
            if (folders.length) {
              actions.push(
                of(
                  FilesActions.getFoldersSuccess({
                    folders: folders.map((item) => ({
                      name: item.name,
                      id: item.url,
                      folderId: getFolderIdFromEntityId(item.url),
                      publishedWithMe: true,
                      type: FeatureType.File,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              const foldersSet = new Set<string>();
              const publicFiles = (items as PublishedFileItem[]).map((item) => {
                const decodedUrl = ApiUtils.decodeApiUrl(item.url);

                const folderId = getFolderIdFromEntityId(decodedUrl);

                foldersSet.add(folderId);
                const { apiKey, bucket, parentPath, name } =
                  splitEntityId(decodedUrl);

                return {
                  contentLength: item.contentLength,
                  contentType: item.contentType,
                  absolutePath: constructPath(apiKey, bucket, parentPath),
                  id: decodedUrl,
                  folderId,
                  name,
                  publishedWithMe: true,
                };
              });

              actions.push(
                of(
                  FilesActions.getFilesSuccess({
                    files: publicFiles,
                    foldersSet,
                  }),
                ),
              );
            }
          }

          return concat(...actions);
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublishedWithMeItemsFail());
        }),
      ),
    ),
  );

const uploadPublishedWithMeItemsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadPublishedWithMeItemsFail.type),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedItemsUploadFailed),
      ),
    ),
  );

const approvePublicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.approvePublication.type),
    switchMap(({ payload }) =>
      PublicationService.approvePublication(payload.url).pipe(
        switchMap(() => {
          const state = state$.value;
          const selectedPublication =
            PublicationSelectors.selectSelectedPublication(state);

          if (!selectedPublication) {
            return of(PublicationActions.approvePublicationFail());
          }

          const actions: Observable<AppAction>[] = [];

          const resourcesToReview =
            PublicationSelectors.selectResourcesToReview(state);

          const conversationResources = selectedPublication.resources.filter(
            (resource) => isConversationId(resource.targetUrl),
          );
          const conversationResourcesToPublish = conversationResources.filter(
            (resource) => resource.action === PublishActions.ADD,
          );
          const conversationResourcesToUnpublish = conversationResources.filter(
            (resource) => resource.action === PublishActions.DELETE,
          );

          if (conversationResourcesToUnpublish.length) {
            const allConversations =
              ConversationsSelectors.selectConversations(state);
            const allFolders = ConversationsSelectors.selectFolders(state);

            const { itemsToHideIds, itemsToRemoveIds } =
              getItemsIdsToRemoveAndHide(
                conversationResourcesToUnpublish,
                resourcesToReview,
              );
            const idsToExclude = [...itemsToRemoveIds, ...itemsToHideIds];
            const filteredConversations = allConversations.filter(
              (conv) => !idsToExclude.includes(conv.id),
            );
            const filteredFolders = allFolders.filter((folder) => {
              const isNotLoaded = folder.status !== UploadStatus.LOADED;
              const isPublic = !isEntityIdPublic(folder);
              const hasConversations = filteredConversations.some((conv) =>
                conv.id.startsWith(`${folder.id}/`),
              );

              return isNotLoaded || isPublic || hasConversations;
            });
            const foldersToHide = allFolders.filter((folder) => {
              const hasConversations = filteredConversations.some((conv) =>
                conv.id.startsWith(`${folder.id}/`),
              );
              const hasHiddenConversations = itemsToHideIds.some((convId) =>
                convId.startsWith(`${folder.id}/`),
              );

              return !hasConversations && hasHiddenConversations;
            });

            const versionGroups = uniq(
              idsToExclude.map((id) =>
                getIdWithoutVersionFromApiKey(id, parseConversationApiKey),
              ),
            );

            actions.push(
              of(
                ConversationsActions.setConversations({
                  conversations: filteredConversations,
                }),
              ),
              of(
                ConversationsActions.addConversations({
                  conversations: allConversations
                    .filter((conv) => itemsToHideIds.includes(conv.id))
                    .map((conv) => ({
                      status: undefined,
                      id: conv.id,
                      model: { id: conv.model.id },
                      name: conv.name,
                      folderId: conv.folderId,
                      publicationInfo: {
                        ...conv.publicationInfo,
                        isNotExist: true,
                        publicationUrl: payload.url,
                      },
                      publishedWithMe: false,
                    })),
                }),
              ),
              of(
                ConversationsActions.setFolders({
                  folders: filteredFolders,
                }),
              ),
              of(
                ConversationsActions.addFolders({
                  folders: foldersToHide.map((folder) => ({
                    ...folder,
                    publishedWithMe: false,
                  })),
                }),
              ),
              of(
                PublicationActions.markResourcesAsReviewedByIds({
                  ids: itemsToHideIds,
                }),
              ),
              of(
                PublicationActions.removePublicVersionGroups({
                  groupsToRemove: versionGroups.map((groupId) => ({
                    groupIds: idsToExclude.filter(
                      (id) =>
                        getIdWithoutVersionFromApiKey(
                          id,
                          parseConversationApiKey,
                        ) === groupId,
                    ),
                    versionGroupId: groupId,
                  })),
                }),
              ),
            );
          }

          if (conversationResourcesToPublish.length) {
            const conversationPaths = uniq(
              conversationResourcesToPublish.flatMap((resource) =>
                getParentFolderIdsFromEntityId(
                  getFolderIdFromEntityId(resource.targetUrl),
                ).filter((folderId) => folderId !== resource.targetUrl),
              ),
            );

            const { publicVersionGroups, items } =
              mapPublishedItems<ConversationInfo>(
                conversationResourcesToPublish.map((resource) => ({
                  id: resource.targetUrl,
                  updatedAt: Date.now(),
                })),
                FeatureType.Chat,
              );

            actions.push(
              of(
                ConversationsActions.addFolders({
                  folders: conversationPaths.map((path) => ({
                    ...getFolderFromId(path, FeatureType.Chat),
                    status: UploadStatus.LOADED,
                    publishedWithMe: path.split('/').length === 3,
                  })),
                }),
              ),
              of(
                ConversationsActions.addConversations({
                  conversations: items.map((item) => {
                    if (item.publicationInfo?.isNotExist) {
                      item.publicationInfo.isNotExist = false;
                    }

                    return item;
                  }),
                }),
              ),
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          const promptResources = selectedPublication.resources.filter(
            (resource) => isPromptId(resource.targetUrl),
          );
          const promptResourcesToPublish = promptResources.filter(
            (resource) => resource.action === PublishActions.ADD,
          );
          const promptResourcesToUnpublish = promptResources.filter(
            (resource) => resource.action === PublishActions.DELETE,
          );

          if (promptResourcesToUnpublish.length) {
            const allPrompts = PromptsSelectors.selectPrompts(state);
            const allFolders = PromptsSelectors.selectFolders(state);
            const { itemsToHideIds, itemsToRemoveIds } =
              getItemsIdsToRemoveAndHide(
                promptResourcesToUnpublish,
                resourcesToReview,
              );
            const idsToExclude = [...itemsToRemoveIds, ...itemsToHideIds];
            const filteredPrompts = allPrompts.filter(
              (prompt) => !idsToExclude.includes(prompt.id),
            );
            const filteredFolders = allFolders.filter((folder) => {
              const isNotLoaded = folder.status !== UploadStatus.LOADED;
              const isPublic = !isEntityIdPublic(folder);
              const hasPrompts = filteredPrompts.some((prompt) =>
                prompt.id.startsWith(`${folder.id}/`),
              );

              return isNotLoaded || isPublic || hasPrompts;
            });
            const foldersToHide = allFolders.filter((folder) => {
              const hasPrompts = filteredPrompts.some((prompt) =>
                prompt.id.startsWith(`${folder.id}/`),
              );
              const hasHiddenPrompts = itemsToHideIds.some((promptId) =>
                promptId.startsWith(`${folder.id}/`),
              );

              return !hasPrompts && hasHiddenPrompts;
            });
            const versionGroups = uniq(
              idsToExclude.map((id) => {
                return getIdWithoutVersionFromApiKey(id, parsePromptApiKey);
              }),
            );

            actions.push(
              of(
                PromptsActions.setPrompts({
                  prompts: filteredPrompts,
                }),
              ),
              of(
                PromptsActions.addPrompts({
                  prompts: allPrompts
                    .filter((prompt) => itemsToHideIds.includes(prompt.id))
                    .map((prompt) => ({
                      status: undefined,
                      id: prompt.id,
                      name: prompt.name,
                      folderId: prompt.folderId,
                      publicationInfo: {
                        ...prompt.publicationInfo,
                        isNotExist: true,
                        publicationUrl: payload.url,
                      },
                      publishedWithMe: false,
                    })),
                }),
              ),
              of(
                PromptsActions.setFolders({
                  folders: filteredFolders,
                }),
              ),
              of(
                PromptsActions.addFolders({
                  folders: foldersToHide.map((folder) => ({
                    ...folder,
                    publishedWithMe: false,
                  })),
                }),
              ),
              of(
                PublicationActions.markResourcesAsReviewedByIds({
                  ids: itemsToHideIds,
                }),
              ),
              of(
                PublicationActions.removePublicVersionGroups({
                  groupsToRemove: versionGroups.map((groupId) => ({
                    groupIds: idsToExclude.filter((id) => {
                      return (
                        getIdWithoutVersionFromApiKey(id, parsePromptApiKey) ===
                        groupId
                      );
                    }),
                    versionGroupId: groupId,
                  })),
                }),
              ),
            );
          }

          if (promptResourcesToPublish.length) {
            const promptPaths = uniq(
              promptResourcesToPublish.flatMap((resource) =>
                getParentFolderIdsFromEntityId(
                  getFolderIdFromEntityId(resource.targetUrl),
                ).filter((folderId) => folderId !== resource.targetUrl),
              ),
            );

            const { publicVersionGroups, items } =
              mapPublishedItems<PromptInfo>(
                promptResourcesToPublish.map((resource) => ({
                  id: resource.targetUrl,
                })),
                FeatureType.Prompt,
              );

            actions.push(
              of(
                PromptsActions.addFolders({
                  folders: promptPaths.map((path) => ({
                    ...getFolderFromId(path, FeatureType.Prompt),
                    status: UploadStatus.LOADED,
                    publishedWithMe: path.split('/').length === 3,
                  })),
                }),
              ),
              of(
                PromptsActions.addPrompts({
                  prompts: items.map((item) => {
                    if (item.publicationInfo?.isNotExist) {
                      item.publicationInfo.isNotExist = false;
                    }

                    return item;
                  }),
                }),
              ),
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          const appResourcesToUnpublish = selectedPublication.resources.filter(
            (r) =>
              r.action === PublishActions.DELETE &&
              isApplicationId(r.targetUrl),
          );

          if (appResourcesToUnpublish.length) {
            appResourcesToUnpublish.forEach((r) => {
              actions.push(
                of(
                  ModelsActions.updateModelPublicationInfo({
                    reference: r.reviewUrl,
                    updatedValues: {
                      isNotExist: true,
                      publicationUrl: payload.url,
                    },
                  }),
                ),
              );
            });
          }

          return concat(
            ...actions,
            of(
              PublicationActions.approvePublicationSuccess({
                url: payload.url,
                triggerModelsListing: selectedPublication.resources.some(
                  (resource) => isApplicationId(resource.reviewUrl),
                ),
                triggerPublicFilesListing: selectedPublication.resources.some(
                  (resource) => isFileId(resource.reviewUrl),
                ),
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.approvePublicationFail(err.message));
        }),
      ),
    ),
  );

const approvePublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.approvePublicationFail.type),
    map(({ payload }) =>
      UIActions.showErrorToast(
        translate(payload ?? errorsMessages.publicationApproveFailed),
      ),
    ),
  );

const rejectPublicationEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.rejectPublication.type),
    switchMap(({ payload }) =>
      PublicationService.rejectPublication(payload.url).pipe(
        switchMap(() =>
          of(PublicationActions.rejectPublicationSuccess({ url: payload.url })),
        ),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.rejectPublicationFail());
        }),
      ),
    ),
  );

const rejectPublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.rejectPublicationFail.type),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationRejectFailed),
      ),
    ),
  );

const approvePublicationSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.approvePublicationSuccess.type),
    switchMap(({ payload }) => {
      const actions: Observable<AppAction>[] = [];

      if (payload.triggerModelsListing) {
        actions.push(of(ModelsActions.getModels()));
      }

      if (payload.triggerPublicFilesListing) {
        actions.push(
          of(
            PublicationActions.uploadPublishedWithMeItems({
              featureType: FeatureType.File,
            }),
          ),
        );
      }

      return concat(...actions);
    }),
  );

const resolvePublicationSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      PublicationActions.rejectPublicationSuccess.type,
      PublicationActions.approvePublicationSuccess.type,
    ),
    switchMap(() => {
      const state = state$.value;

      const publications = PublicationSelectors.selectPublications(state);

      if (!publications.length) {
        const conversations = ConversationsSelectors.selectConversations(state);

        return iif(
          () => !!conversations.length,
          of(
            ConversationsActions.selectConversations({
              conversationIds: [conversations[0].id],
            }),
          ),
          of(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          ),
        );
      }

      return of(
        PublicationActions.uploadPublication({ url: publications[0].url }),
      );
    }),
  );

const uploadRulesEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadRules.type),
    switchMap(({ payload }) =>
      PublicationService.getRules(payload.path).pipe(
        switchMap((rules) => {
          return of(
            PublicationActions.uploadRulesSuccess({
              ruleRecords: rules,
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadRulesFail(err.message));
        }),
      ),
    ),
  );

const uploadRulesFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadRulesFail.type),
    map(({ payload }) =>
      UIActions.showErrorToast(
        translate(payload ?? errorsMessages.rulesUploadingFailed),
      ),
    ),
  );

const uploadAllPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.uploadAllPublishedWithMeItems.type),
    filter(
      ({ payload }) =>
        SettingsSelectors.selectIsPublishingEnabled(
          state$.value,
          payload.featureType,
        ) &&
        !PublicationSelectors.selectIsAllItemsUploaded(
          state$.value,
          payload.featureType,
        ),
    ),
    mergeMap(({ payload }) => {
      return PublicationService.getPublishedWithMeItems(
        '',
        payload.featureType,
        {
          recursive: true,
        },
      ).pipe(
        switchMap((publications) => {
          if (!publications.items) {
            return EMPTY;
          }

          const actions: Observable<AppAction>[] = [];

          const publicationItems = publications.items.map((item) => ({
            ...item,
            id: item.url,
            updatedAt: item.updatedAt,
          }));
          const paths = uniq(
            publicationItems.flatMap(({ id }) =>
              getParentFolderIdsFromFolderId(getFolderIdFromEntityId(id)),
            ),
          );
          const folders = getFoldersFromIds(
            paths,
            payload.featureType === FeatureType.Chat
              ? FeatureType.Chat
              : FeatureType.Prompt,
            UploadStatus.LOADED,
          ).map((folder) => ({
            ...folder,
            publishedWithMe: isRootId(getFolderIdFromEntityId(folder.id)),
          }));

          if (payload.featureType === FeatureType.Chat) {
            const { publicVersionGroups, items: conversations } =
              mapPublishedItems<ConversationInfo>(
                publicationItems,
                payload.featureType,
              );

            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
              of(
                ConversationsActions.uploadChildConversationsWithFoldersSuccess(
                  {
                    parentIds: paths,
                    folders,
                    conversations,
                  },
                ),
              ),
            );
          } else if (payload.featureType === FeatureType.Prompt) {
            const { publicVersionGroups, items: prompts } =
              mapPublishedItems<PromptInfo>(
                publicationItems,
                payload.featureType,
              );

            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
              of(
                PromptsActions.uploadChildPromptsWithFoldersSuccess({
                  parentIds: paths,
                  folders,
                  prompts,
                }),
              ),
            );
          }

          return concat(
            ...actions,
            of(
              PublicationActions.uploadAllPublishedWithMeItemsSuccess({
                featureType: payload.featureType,
              }),
            ),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadAllPublishedWithMeItemsFail());
        }),
      );
    }),
  );

const uploadAllPublishedWithMeItemsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PublicationActions.uploadAllPublishedWithMeItemsFail.type),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedItemsUploadFailed),
      ),
    ),
  );

const updatePublicationRequestAndEntityEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updatePublicationRequestAndEntity.type),
    switchMap(({ payload }) => {
      const state = state$.value;
      const publication = PublicationSelectors.selectPublicationByUrl(
        state,
        payload.publicationUrl,
      );

      const isConversation = isConversationId(payload.newEntity.id);

      if (!publication) {
        return of(
          UIActions.showErrorToast(
            translate(
              `Cannot update ${isConversation ? 'conversation' : 'prompt'}, publication not found`,
            ),
          ),
        );
      }

      if (!publication.resources) {
        return of(
          UIActions.showErrorToast(
            translate(
              `Cannot update ${isConversation ? 'conversation' : 'prompt'}, publication has no resources`,
            ),
          ),
        );
      }

      const publicationData: PublicationUpdateRequestModel = {
        ...publication,
        resources: publication.resources.map((resource) => {
          if (resource.reviewUrl === payload.resourceToUpdateUrl) {
            const newTargetUrlSegments = payload.newEntity.id.split('/');
            newTargetUrlSegments[1] = publication.targetFolder;
            const newTargetUrl = newTargetUrlSegments.join('/');

            return {
              ...resource,
              sourceUrl: resource.sourceUrl ?? '',
              targetUrl: newTargetUrl,
            };
          }

          return {
            ...resource,
            sourceUrl: resource.sourceUrl ?? '',
          };
        }),
      };

      return PublicationService.updatePublicationRequest({
        publicationData,
        url: payload.publicationUrl,
      }).pipe(
        switchMap(() => {
          const updateEntityPayload = {
            id: payload.newEntity.id,
            values: payload.newEntity,
          };

          const isConversationResource = isConversationId(payload.newEntity.id);

          const updateEntityActions: Observable<AppAction>[] = [
            of(
              isConversationResource
                ? ConversationsActions.updateConversation(updateEntityPayload)
                : PromptsActions.updatePrompt(updateEntityPayload),
            ),
          ];

          if (isConversationResource) {
            const selectedConversationIds =
              ConversationsSelectors.selectSelectedConversationsIds(state);
            if (selectedConversationIds.includes(payload.resourceToUpdateUrl)) {
              updateEntityActions.push(
                of(
                  ConversationsActions.selectConversations({
                    conversationIds: selectedConversationIds.map((id) =>
                      id === payload.resourceToUpdateUrl
                        ? payload.newEntity.id
                        : id,
                    ),
                    suspendHideSidebar: false,
                  }),
                ),
              );
            }
          } else {
            updateEntityActions.push(
              of(
                PromptsActions.selectPrompt({
                  promptId: payload.newEntity.id,
                  isApproveRequiredResource: true,
                }),
              ),
            );
          }

          return concat(
            of(
              PublicationActions.uploadPublication({
                url: payload.publicationUrl,
              }),
            ),
            ...updateEntityActions,
          );
        }),
        catchError((err) => {
          return of(PublicationActions.publishFail(err.message));
        }),
      );
    }),
  );

const updatePublicationRequestAndFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updatePublicationRequestAndFolder.type),
    switchMap(({ payload }) => {
      const state = state$.value;
      const publication = PublicationSelectors.selectPublicationByUrl(
        state,
        payload.publicationUrl,
      );

      if (!publication) {
        return of(
          UIActions.showErrorToast(
            translate('Cannot update folder, publication not found'),
          ),
        );
      }

      if (!publication.resources) {
        return of(
          UIActions.showErrorToast(
            translate('Cannot update folder, publication has no resources'),
          ),
        );
      }

      const publicationData: PublicationUpdateRequestModel = {
        ...publication,
        resources: publication.resources.map((resource) => {
          if (resource.reviewUrl.startsWith(`${payload.folderIdToUpdate}/`)) {
            const folderIdToUpdateSegments =
              payload.folderIdToUpdate.split('/');
            folderIdToUpdateSegments[1] = publication.targetFolder;
            const targetFolderIdToUpdate = folderIdToUpdateSegments.join('/');

            const newFolderIdSegments = payload.newFolder.id.split('/');
            newFolderIdSegments[1] = publication.targetFolder;
            const newTargetFolderId = newFolderIdSegments.join('/');

            return {
              ...resource,
              sourceUrl: resource.sourceUrl ?? '',
              targetUrl: resource.targetUrl.replace(
                `${targetFolderIdToUpdate}/`,
                `${newTargetFolderId}/`,
              ),
            };
          }

          return {
            ...resource,
            sourceUrl: resource.sourceUrl ?? '',
          };
        }),
      };

      return PublicationService.updatePublicationRequest({
        publicationData,
        url: payload.publicationUrl,
      }).pipe(
        switchMap(() => {
          const updateFolderPayload = {
            folderId: payload.newFolder.id,
            values: payload.newFolder,
          };

          const updateFolderAction$ = of(
            isConversationId(payload.folderIdToUpdate)
              ? ConversationsActions.updateFolder(updateFolderPayload)
              : PromptsActions.updateFolder(updateFolderPayload),
          );

          return concat(
            updateFolderAction$,
            of(
              PublicationActions.uploadPublication({
                url: payload.publicationUrl,
              }),
            ),
          );
        }),
        catchError((err) => {
          return of(PublicationActions.publishFail(err.message));
        }),
      );
    }),
  );

const updatePublicationRequestEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updatePublicationRequest.type),
    switchMap(({ payload }) =>
      forkJoin({
        payload: processPublicationResources(payload.dataToUpdate),
        url: of(payload.url),
      }),
    ),
    switchMap(({ payload, url }) => {
      const { publicationData } = payload;

      return PublicationService.updatePublicationRequest({
        publicationData,
        url,
      }).pipe(
        switchMap((response) => {
          const state = state$.value;

          const oldPublicationResources =
            PublicationSelectors.selectPublicationByUrl(state, url)
              ?.resources ?? [];
          const newPublicationResources = response.resources.map(
            (resource) => ({
              ...resource,
              sourceUrl: ApiUtils.decodeApiUrl(resource.sourceUrl ?? ''),
              targetUrl: ApiUtils.decodeApiUrl(resource.targetUrl),
              reviewUrl: ApiUtils.decodeApiUrl(resource.reviewUrl ?? ''),
            }),
          );

          const resourcesRequiresUpdate = newPublicationResources.filter(
            (newResource) => {
              const match = oldPublicationResources.find(
                (oldResource) =>
                  oldResource?.sourceUrl === newResource.sourceUrl,
              );

              return match && match.targetUrl !== newResource.targetUrl;
            },
          );
          const resourcesRequiresUpdateIds = resourcesRequiresUpdate.map(
            (resource) => resource.reviewUrl,
          );

          const [
            conversationsRequiresUpdate,
            promptsRequiresUpdate,
            applicationsRequiresUpdate,
            filesToUpdate,
          ] = [
            FeatureType.Chat,
            FeatureType.Prompt,
            FeatureType.Application,
            FeatureType.File,
          ].map((featureType) =>
            filterIdsByFeatureType(resourcesRequiresUpdateIds, featureType),
          );

          if (
            !conversationsRequiresUpdate.length &&
            !promptsRequiresUpdate.length &&
            !applicationsRequiresUpdate.length &&
            !filesToUpdate.length
          ) {
            return of(PublicationActions.uploadPublication({ url }));
          }

          const observables: {
            conversations: Observable<(Conversation | null)[]>;
            prompts: Observable<(Prompt | null)[]>;
            applications: Observable<(CustomApplicationModel | null)[]>;
          } = {
            conversations: of([]),
            prompts: of([]),
            applications: of([]),
          };

          if (conversationsRequiresUpdate.length || filesToUpdate.length) {
            const resourcesNotRequiresUpdate = newPublicationResources
              .filter(
                (resource) =>
                  !resourcesRequiresUpdateIds.includes(resource.reviewUrl),
              )
              .map((resource) => resource.reviewUrl);
            const conversationsNotRequiresUpdate = filterIdsByFeatureType(
              resourcesNotRequiresUpdate,
              FeatureType.Chat,
            );
            const conversationsToUpload = filesToUpdate.length
              ? [
                  ...conversationsNotRequiresUpdate,
                  ...conversationsRequiresUpdate,
                ]
              : conversationsRequiresUpdate;

            observables.conversations = forkJoin(
              conversationsToUpload.map((id) => {
                return ConversationService.getConversation(
                  getConversationInfoFromId(id, { parseVersion: true }),
                );
              }),
            );
          }

          if (promptsRequiresUpdate.length) {
            observables.prompts = forkJoin(
              promptsRequiresUpdate.map((id) =>
                PromptService.getPrompt(
                  getPromptInfoFromId(id, { parseVersion: true }),
                ),
              ),
            );
          }

          if (applicationsRequiresUpdate.length) {
            observables.applications = forkJoin(
              applicationsRequiresUpdate.map((id) =>
                ApplicationService.get(id),
              ),
            );
          }

          return forkJoin(observables).pipe(
            switchMap((results) => {
              const actions: Observable<AppAction>[] = [];

              const conversations = results.conversations.filter(
                Boolean,
              ) as Conversation[];
              const prompts = results.prompts.filter(Boolean) as Prompt[];
              const applications = results.applications.filter(
                Boolean,
              ) as CustomApplicationModel[];

              if (conversations.length) {
                if (filesToUpdate.length) {
                  const titlesToUpdate = filesToUpdate.map(getLastPathSegment);

                  actions.push(
                    ...conversations.map((conversation) => {
                      return of(
                        ConversationsActions.updateConversation({
                          id: conversation.id,
                          values: {
                            name: conversation.name,
                            publicationInfo: {
                              version: getVersionFromId(conversation.id),
                              publicationUrl: url,
                            },
                            messages: updateAttachmentTitles(
                              conversation.messages,
                              titlesToUpdate,
                            ),
                            playback: conversation.playback
                              ? {
                                  ...conversation.playback,
                                  messagesStack: updateAttachmentTitles(
                                    conversation.playback.messagesStack,
                                    titlesToUpdate,
                                  ),
                                }
                              : undefined,
                          },
                        }),
                      );
                    }),
                  );
                } else {
                  actions.push(
                    ...conversations.map((conversation) =>
                      of(
                        ConversationsActions.updateConversation({
                          id: conversation.id,
                          values: {
                            name: conversation.name,
                            publicationInfo: {
                              version: getVersionFromId(conversation.id),
                              publicationUrl: url,
                            },
                          },
                        }),
                      ),
                    ),
                  );
                }
              }

              if (prompts.length) {
                actions.push(
                  ...prompts.map((prompt) =>
                    of(
                      PromptsActions.updatePrompt({
                        id: prompt.id,
                        values: {
                          name: prompt.name,
                          publicationInfo: {
                            version: getVersionFromId(prompt.id),
                            publicationUrl: url,
                          },
                        },
                      }),
                    ),
                  ),
                );
              }

              if (applications.length) {
                actions.push(
                  ...applications.map((application) => {
                    const newApplication = {
                      ...application,
                      name: parseApplicationApiKey(
                        splitEntityId(application.id).name,
                      ).name,
                      version: getVersionFromId(application.id),
                    };

                    if (newApplication.applicationTypeSchemaId) {
                      return ApplicationTypesSchemasService.getApplicationTypeSchema(
                        newApplication.applicationTypeSchemaId,
                      ).pipe(
                        switchMap((schema) => {
                          return of(
                            ApplicationActions.update({
                              oldApplication: application,
                              applicationData: newApplication,
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
                        oldApplication: application,
                        applicationData: newApplication,
                      }),
                    );
                  }),
                );
              }

              return concat(
                ...actions,
                of(PublicationActions.uploadPublication({ url })),
              );
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.publishFail(err.message));
        }),
      );
    }),
  );

const updateAndApprovePublicationRequestEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updateAndApprovePublicationRequest.type),
    switchMap(() => {
      const state = state$.value;
      const selectedPublication =
        PublicationSelectors.selectSelectedPublication(state);
      if (!selectedPublication) {
        return of(PublicationActions.approvePublicationFail());
      }
      const resourcesToApproveIds =
        PublicationSelectors.selectSelectedItemsToPublish(state);
      const filteredResources = selectedPublication.resources
        .filter(({ reviewUrl }) => resourcesToApproveIds.includes(reviewUrl))
        .map((resource) => ({
          ...resource,
          sourceUrl: resource.sourceUrl ?? '',
        }));
      return PublicationService.updatePublicationRequest({
        url: selectedPublication.url,
        publicationData: {
          ...selectedPublication,
          resources: filteredResources,
        },
      }).pipe(
        switchMap((response) => {
          return of(
            PublicationActions.approvePublication({
              url: response.url,
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.publishFail(err.message));
        }),
      );
    }),
  );

const onSelectPublicationEffectEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.selectPublication.type),
    switchMap(() => {
      const publication = PublicationSelectors.selectSelectedPublication(
        state$.value,
      );
      const resources = publication?.resources;

      if (!publication) {
        console.error('Publication not found, cannot select items to approve');
        return EMPTY;
      }

      const selectedItemsToApprove =
        PublicationSelectors.selectAllSelectedItemsToApprove(state$.value);

      if (selectedItemsToApprove[publication.url] !== undefined) {
        return EMPTY;
      }

      return of(
        PublicationActions.setItemsToApprove({
          publicationUrl: publication?.url ?? '',
          ids: resources?.map(({ reviewUrl }) => reviewUrl) ?? [],
        }),
      );
    }),
  );

export const PublicationEpics = combineEpics(
  // init
  initEpic,

  // create publication
  publishEpic,
  publishFailEpic,

  // upload publications
  uploadPublicationsEpic,
  uploadPublicationsFailEpic,
  uploadPublicationEpic,
  uploadPublicationFailEpic,

  // upload published resources
  uploadPublishedWithMeItemsEpic,
  uploadPublishedWithMeItemsFailEpic,
  uploadAllPublishedWithMeItemsEpic,
  uploadAllPublishedWithMeItemsFailEpic,

  // resolve publications
  approvePublicationEpic,
  approvePublicationFailEpic,
  rejectPublicationEpic,
  rejectPublicationFailEpic,
  approvePublicationSuccessEpic,
  resolvePublicationSuccessEpic,

  // upload rules
  uploadRulesEpic,
  uploadRulesFailEpic,

  // update publication request
  updatePublicationRequestEpic,
  updateAndApprovePublicationRequestEpic,
  updatePublicationRequestAndEntityEpic,
  updatePublicationRequestAndFolderEpic,

  // on select publication
  onSelectPublicationEffectEpic,
);
