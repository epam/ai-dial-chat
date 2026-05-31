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
  updateMessagesAttachmentsTitles,
} from '@/src/utils/app/conversation';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import { getOrUploadConversation } from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { ToolsetService } from '@/src/utils/app/data/toolset-service';
import {
  addMessageAttachmentsToPublication$,
  getDeletedEntities,
  getPublicationResourceEntityData,
  getSetUpdatedItemsToApproveAction$,
  getUpdateApplicationGeneralInfoAction$,
} from '@/src/utils/app/epics-helpers/publications.epic-helpers';
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
  getIdWithoutRootPathSegments,
  isApplicationId,
  isConversationId,
  isFileId,
  isMyEntity,
  isPromptId,
  isRootEntity,
  isRootId,
  isToolsetId,
} from '@/src/utils/app/id';
import { getPromptInfoFromId } from '@/src/utils/app/prompts';
import {
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
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { ApiKeys, EntityType, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { PromptInfo } from '@/src/types/prompt';
import {
  PublicationRequestModel,
  PublicationResource,
  PublishedFileItem,
} from '@/src/types/publication';
import { AppAction, AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  FilesActions,
  ModelsActions,
  PromptsActions,
  PublicationActions,
  ToolsetActions,
  UIActions,
} from '@/src/store/actions';
import {
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PromptsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys, CommonI18nKeys } from '@/src/constants/i18n';

import {
  Conversation,
  ConversationInfo,
  Feature,
  Prompt,
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';
import { lookup as lookupMime } from 'mime-types';

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
            CommonI18nKeys.PublicationWithExternalFilesFailed,
          ),
        );
      }

      return PublicationService.createPublicationRequest({
        ...publicationData,
      }).pipe(
        switchMap(() =>
          of(
            UIActions.showSuccessToast(
              translate(CommonI18nKeys.PublicationRequestCreatedSuccessfully, {
                ns: Translation.Common,
              }),
            ),
          ),
        ),
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
      return UIActions.showErrorToast({
        message: translate(payload ?? CommonI18nKeys.PublicationFailed, {
          ns: Translation.Common,
        }),
      });
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
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.PublicationsUploadFailed, {
          ns: Translation.Common,
        }),
      }),
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
              publication: of(publication),
              uploadedUnpublishIdsSet: from(rootFolderPaths).pipe(
                mergeMap((path) => {
                  const isRoot = !isRootId(path);

                  if (isConversationId(path)) {
                    return ConversationService.getConversations(path, isRoot);
                  }

                  if (isPromptId(path)) {
                    return PromptService.getPrompts(path, isRoot);
                  }

                  if (isToolsetId(path)) {
                    return ToolsetService.getToolsetsByPath(path);
                  }

                  return ApplicationService.getAllByPath(path, isRoot);
                }),
                toArray(),
                map((data) => new Set(data.flat().map((data) => data.id))),
              ),
            });
          }

          return of({
            publication,
            uploadedUnpublishIdsSet: new Set<string>(),
          });
        }),
        switchMap(({ publication, uploadedUnpublishIdsSet }) => {
          const actions: AppAction[] = [];
          const grouped = groupBy(publication.resources, ({ reviewUrl }) => {
            if (isConversationId(reviewUrl)) return ApiKeys.Conversations;
            if (isPromptId(reviewUrl)) return ApiKeys.Prompts;
            if (isApplicationId(reviewUrl)) return ApiKeys.Applications;
            if (isToolsetId(reviewUrl)) return ApiKeys.Toolsets;
            return ApiKeys.Files;
          });

          const conversationResources = grouped[ApiKeys.Conversations] ?? [];
          const promptResources = grouped[ApiKeys.Prompts] ?? [];
          const applicationResources = grouped[ApiKeys.Applications] ?? [];
          const toolsetResources = grouped[ApiKeys.Toolsets] ?? [];
          const fileResources = grouped[ApiKeys.Files] ?? [];

          const getParentPaths = (resources: PublicationResource[]) =>
            uniq(
              resources.flatMap(({ reviewUrl }) =>
                getParentFolderIdsFromEntityId(
                  getFolderIdFromEntityId(reviewUrl),
                ).filter((id) => id !== reviewUrl),
              ),
            );

          if (conversationResources.length) {
            actions.push(
              ConversationsActions.addConversations({
                conversations: getPublicationResourceEntityData(
                  conversationResources,
                  uploadedUnpublishIdsSet,
                  payload.url,
                ),
              }),
              ConversationsActions.addFolders({
                folders: getFoldersFromIds(
                  getParentPaths(conversationResources),
                  FeatureType.Chat,
                  UploadStatus.LOADED,
                ),
              }),
            );
          }

          if (promptResources.length) {
            actions.push(
              PromptsActions.addPrompts({
                prompts: getPublicationResourceEntityData(
                  promptResources,
                  uploadedUnpublishIdsSet,
                  payload.url,
                ),
              }),
              PromptsActions.addFolders({
                folders: getFoldersFromIds(
                  getParentPaths(promptResources),
                  FeatureType.Prompt,
                  UploadStatus.LOADED,
                ),
              }),
            );
          }

          const createMarketplaceEntityExtraFields =
            (type: EntityType) => (resource: PublicationResource) => ({
              type,
              owner: resource.author ?? 'Unknown',
              isDefault: false,
              reference: resource.reviewUrl,
            });

          if (applicationResources.length) {
            actions.push(
              ModelsActions.addPublishRequestModels({
                models:
                  getPublicationResourceEntityData<PublishRequestDialAIEntityModel>(
                    applicationResources,
                    uploadedUnpublishIdsSet,
                    payload.url,
                    createMarketplaceEntityExtraFields(EntityType.Application),
                  ),
              }),
            );
          }

          if (toolsetResources.length) {
            actions.push(
              ToolsetActions.addPublishRequestToolsets({
                toolsets:
                  getPublicationResourceEntityData<PublishRequestDialAIEntityModel>(
                    toolsetResources,
                    uploadedUnpublishIdsSet,
                    payload.url,
                    createMarketplaceEntityExtraFields(EntityType.Toolset),
                  ),
              }),
            );
          }

          if (fileResources.length) {
            const files = getPublicationResourceEntityData<DialFile>(
              fileResources,
              uploadedUnpublishIdsSet,
              payload.url,
              ({ reviewUrl }) => ({
                absolutePath: getFolderIdFromEntityId(reviewUrl),
                contentLength: 0,
                contentType: lookupMime(reviewUrl.split('.').pop() ?? '') || '',
              }),
            );

            actions.push(
              FilesActions.getFoldersSuccess({
                folders: getFoldersFromIds(
                  getParentPaths(fileResources),
                  FeatureType.File,
                  UploadStatus.LOADED,
                ),
              }),
              FilesActions.getFilesSuccess({
                files,
                foldersSet: new Set(files.map((file) => file.folderId)),
              }),
            );
          }

          // we do not need to review files
          const existingReviewedResources =
            PublicationSelectors.selectResourcesToReviewByPublicationUrl(
              state$.value,
              publication.url,
            );
          const resourcesToReview = publication.resources.filter(
            ({ reviewUrl }) => !isFileId(reviewUrl),
          );

          return from([
            PublicationActions.setPublicationsToReview({
              items: resourcesToReview.map((resource) => {
                const matched = existingReviewedResources.find(
                  (r) => r.sourceUrl === resource.sourceUrl,
                );
                return {
                  reviewed: matched?.reviewed ?? false,
                  reviewUrl: resource.reviewUrl,
                  sourceUrl: resource.sourceUrl ?? '',
                };
              }),
              publicationUrl: publication.url,
            }),
            PublicationActions.uploadPublicationSuccess({
              publication: {
                ...publication,
                uploadStatus: UploadStatus.LOADED,
              },
            }),
            PublicationActions.selectPublication(publication.url),
            ...actions,
          ]);
        }),
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
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.PublicationUploadFailed, {
          ns: Translation.Common,
        }),
      }),
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
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.PublishedItemsUploadFailed, {
          ns: Translation.Common,
        }),
      }),
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
              idsToExclude.map(getIdWithoutVersionFromApiKey),
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
                      (id) => getIdWithoutVersionFromApiKey(id) === groupId,
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
                    publishedWithMe: isRootEntity(path),
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
              idsToExclude.map(getIdWithoutVersionFromApiKey),
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
                    groupIds: idsToExclude.filter(
                      (id) => getIdWithoutVersionFromApiKey(id) === groupId,
                    ),
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
                    publishedWithMe: isRootEntity(path),
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

          const toolsetResourcesToPublish =
            selectedPublication.resources.filter((r) =>
              isToolsetId(r.targetUrl),
            );

          if (toolsetResourcesToPublish.length) {
            const toolsetsMap = ToolsetSelectors.selectToolsetsMap(state);
            const toolsetsToRemove = toolsetResourcesToPublish
              .map((r) => toolsetsMap[r.reviewUrl])
              .filter((t) => !!t);

            actions.push(
              ...toolsetsToRemove.map((t) =>
                of(
                  ToolsetActions.deleteToolsetSuccess({
                    reference: t.reference,
                  }),
                ),
              ),
              of(ToolsetActions.getToolsets()),
            );
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
      UIActions.showErrorToast({
        message: translate(payload ?? CommonI18nKeys.PublicationApproveFailed, {
          ns: Translation.Common,
        }),
      }),
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
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.PublicationRejectFailed, {
          ns: Translation.Common,
        }),
      }),
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
              names: [
                translate(ChatI18nKeys.NewConversation, {
                  ns: Translation.Chat,
                }),
              ],
            }),
          ),
        );
      }

      return ConversationService.setSelectedConversationsIds([]).pipe(
        map(() =>
          PublicationActions.uploadPublication({ url: publications[0].url }),
        ),
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
      UIActions.showErrorToast({
        message: translate(payload ?? CommonI18nKeys.RulesUploadingFailed, {
          ns: Translation.Common,
        }),
      }),
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
      UIActions.showErrorToast({
        message: translate(CommonI18nKeys.PublishedItemsUploadFailed, {
          ns: Translation.Common,
        }),
      }),
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
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateEntityPublicationNotFound,
              {
                ns: Translation.Common,
                entityType: isConversation ? 'conversation' : 'prompt',
              },
            ),
          }),
        );
      }

      if (!publication.resources) {
        return of(
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateEntityPublicationNoResources,
              {
                ns: Translation.Common,
                entityType: isConversation ? 'conversation' : 'prompt',
              },
            ),
          }),
        );
      }

      const publicationData: PublicationRequestModel = {
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

          const { selectedPromptId } =
            PromptsSelectors.selectSelectedPromptId(state);
          const selectedConversationIds =
            ConversationsSelectors.selectSelectedConversationsIds(state);

          const updateEntityAction$: Observable<AppAction> = of(
            isConversationResource
              ? ConversationsActions.updateConversation({
                  ...updateEntityPayload,
                  selectUpdatedOptions: {
                    selectUpdated: selectedConversationIds.includes(
                      payload.resourceToUpdateUrl,
                    ),
                    compareConversationId:
                      selectedConversationIds.length > 1
                        ? selectedConversationIds.filter(
                            (id) => id !== payload.resourceToUpdateUrl,
                          )[0]
                        : undefined,
                  },
                })
              : PromptsActions.updatePrompt({
                  ...updateEntityPayload,
                  selectUpdated:
                    selectedPromptId === payload.resourceToUpdateUrl,
                }),
          );

          const clearOldStateAction$ = of(
            isConversationResource
              ? ConversationsActions.setConversations({
                  conversations: ConversationsSelectors.selectConversations(
                    state,
                  ).filter(
                    (conversation) =>
                      conversation.id !== payload.resourceToUpdateUrl,
                  ),
                })
              : PromptsActions.setPrompts({
                  prompts: PromptsSelectors.selectPrompts(state).filter(
                    (prompt) => prompt.id !== payload.resourceToUpdateUrl,
                  ),
                }),
          );

          const selectedPublicationItems =
            PublicationSelectors.selectSelectedPublicationItems(
              state,
              payload.publicationUrl,
            );

          return concat(
            updateEntityAction$,
            clearOldStateAction$,
            of(
              PublicationActions.uploadPublication({
                url: payload.publicationUrl,
              }),
            ),
            of(
              PublicationActions.setPublicationItems({
                publicationUrl: payload.publicationUrl,
                ids: selectedPublicationItems.map((id) =>
                  id === payload.resourceToUpdateUrl
                    ? payload.newEntity.id
                    : id,
                ),
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

const updateApplicationPublicationUrlsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updateApplicationPublicationUrls.type),
    switchMap(({ payload }) => {
      const {
        isSaveAndExit,
        publicationUrl,
        oldApplication,
        newApplication,
        tabToOpen,
      } = payload;
      const publication = PublicationSelectors.selectPublicationByUrl(
        state$.value,
        publicationUrl,
      );

      if (!publication || !publication?.resources || !publicationUrl) {
        return of(
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateApplicationPublicationNotFound,
              {
                ns: Translation.Common,
              },
            ),
          }),
        );
      }

      const resources = publication.resources.map((resource) => ({
        action: resource.action,
        sourceUrl: resource.sourceUrl ?? '',
        targetUrl:
          resource.reviewUrl === oldApplication.id
            ? constructPath(
                getFolderIdFromEntityId(resource.targetUrl),
                splitEntityId(newApplication.id).name,
              )
            : resource.targetUrl,
      }));

      return PublicationService.updatePublicationRequest({
        publicationData: {
          ...publication,
          resources,
        },
        url: publicationUrl,
      }).pipe(
        switchMap((response) => {
          const state = state$.value;

          const selectedPublicationItems =
            PublicationSelectors.selectSelectedPublicationItems(
              state,
              publicationUrl,
            );

          return concat(
            getUpdateApplicationGeneralInfoAction$(
              // oldApplication is not exist after update, so we need to replace it with newApplication.id
              { ...oldApplication, id: newApplication.id },
              newApplication,
              isSaveAndExit,
              tabToOpen,
            ),
            of(
              PublicationActions.setPublicationItems({
                publicationUrl: response.url,
                ids: selectedPublicationItems.map((id) =>
                  id === oldApplication.id ? newApplication.id : id,
                ),
              }),
            ),
            of(
              PublicationActions.uploadPublication({
                url: response.url,
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

const updatePublicationRequestAndApplicationIconEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(PublicationActions.updatePublicationRequestAndApplicationIcon.type),
    switchMap(({ payload }) => {
      const {
        isSaveAndExit,
        publicationUrl,
        newApplication,
        oldApplication,
        tabToOpen,
      } = payload;

      if (!newApplication.iconUrl) {
        return EMPTY;
      }

      const state = state$.value;
      const publication = PublicationSelectors.selectPublicationByUrl(
        state,
        publicationUrl,
      );

      if (!publication) {
        return of(
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateApplicationIconPublicationNotFound,
              {
                ns: Translation.Common,
              },
            ),
          }),
        );
      }

      const resources: PublicationRequestModel['resources'] =
        publication.resources?.map((resource) => ({
          ...resource,
          sourceUrl: resource.sourceUrl ?? '',
        })) ?? [];

      const newIconUrl = newApplication.iconUrl.split('/');
      resources.push({
        action: PublishActions.ADD_IF_ABSENT,
        sourceUrl: newApplication.iconUrl,
        targetUrl: ApiUtils.decodeApiUrl(
          constructPath(
            newIconUrl[0],
            publication.targetFolder,
            getFolderIdFromEntityId(
              getIdWithoutRootPathSegments(newApplication.id),
            ),
            newIconUrl.at(-1),
          ),
        ),
      });

      return PublicationService.updatePublicationRequest({
        publicationData: {
          ...publication,
          resources: uniqBy(resources, 'sourceUrl'),
        },
        url: publicationUrl,
      }).pipe(
        switchMap((response) => {
          const newIconUrl =
            response.resources.find(
              ({ sourceUrl }) => sourceUrl === newApplication.iconUrl,
            )?.reviewUrl ?? '';
          const newApplicationWithMappedIconUrl = {
            ...newApplication,
            iconUrl: newIconUrl,
          };

          const selectedPublicationItems =
            PublicationSelectors.selectSelectedPublicationItems(
              state,
              publicationUrl,
            );

          return concat(
            getUpdateApplicationGeneralInfoAction$(
              oldApplication,
              newApplicationWithMappedIconUrl,
              isSaveAndExit,
              tabToOpen,
            ),
            of(
              PublicationActions.setPublicationItems({
                publicationUrl,
                ids: [...selectedPublicationItems, newIconUrl],
              }),
            ),
            of(
              PublicationActions.uploadPublication({
                url: publicationUrl,
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

const updatePublicationRequestAndFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PublicationActions.updatePublicationRequestAndFolder.type),
    switchMap(({ payload }) => {
      const state = state$.value;
      const publication = PublicationSelectors.selectPublicationByUrl(
        state,
        payload.publicationUrl,
      );
      const oldPublicationResources = publication?.resources ?? [];

      if (!publication) {
        return of(
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateFolderPublicationNotFound,
              {
                ns: Translation.Common,
              },
            ),
          }),
        );
      }

      if (!publication.resources) {
        return of(
          UIActions.showErrorToast({
            message: translate(
              CommonI18nKeys.CannotUpdateFolderPublicationNoResources,
              {
                ns: Translation.Common,
              },
            ),
          }),
        );
      }

      const publicationData: PublicationRequestModel = {
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
        switchMap((updatedPublication) => {
          const actions: Observable<AppAction>[] = [];

          const updateFolderPayload = {
            folderId: payload.newFolder.id,
            values: payload.newFolder,
          };

          if (isConversationId(payload.folderIdToUpdate)) {
            actions.push(
              of(ConversationsActions.updateFolder(updateFolderPayload)),
              of(
                ConversationsActions.setConversations({
                  conversations: ConversationsSelectors.selectConversations(
                    state,
                  ).filter(
                    (conv) =>
                      !conv.id.startsWith(`${payload.folderIdToUpdate}/`),
                  ),
                }),
              ),
            );
          } else {
            actions.push(
              of(PromptsActions.updateFolder(updateFolderPayload)),
              of(
                PromptsActions.setPrompts({
                  prompts: PromptsSelectors.selectPrompts(state).filter(
                    (prompt) =>
                      !prompt.id.startsWith(`${payload.folderIdToUpdate}/`),
                  ),
                }),
              ),
            );
          }

          return concat(
            ...actions,
            getSetUpdatedItemsToApproveAction$(
              state,
              oldPublicationResources,
              updatedPublication.resources,
              payload.publicationUrl,
            ),
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
        switchMap(({ resources: updatedResources }) => {
          const state = state$.value;

          const oldPublicationResources =
            PublicationSelectors.selectPublicationByUrl(state, url)
              ?.resources ?? [];

          const resourcesRequiresUpdate = updatedResources.filter(
            (newResource) => {
              const match = oldPublicationResources.find(
                (oldResource) =>
                  oldResource?.sourceUrl === newResource.sourceUrl,
              );

              return match && match.targetUrl !== newResource.targetUrl;
            },
          );
          const resourcesRequiresUpdateIds = resourcesRequiresUpdate.map(
            ({ reviewUrl }) => reviewUrl,
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
            conversations?: Observable<(Conversation | null)[]>;
            prompts?: Observable<(Prompt | null)[]>;
            applications?: Observable<(CustomApplicationModel | null)[]>;
          } = {};

          if (conversationsRequiresUpdate.length || filesToUpdate.length) {
            const resourcesNotRequiresUpdate = updatedResources
              .map(({ reviewUrl }) => reviewUrl)
              .filter(
                (reviewUrl) => !resourcesRequiresUpdateIds.includes(reviewUrl),
              );
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

            if (conversationsToUpload.length) {
              observables.conversations = forkJoin(
                conversationsToUpload.map((id) =>
                  ConversationService.getConversation(
                    getConversationInfoFromId(id, { parseVersion: true }),
                  ),
                ),
              );
            }
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

          const hasObservables = Object.keys(observables).length > 0;

          const fetchData$ = hasObservables
            ? forkJoin(observables)
            : of({
                conversations: [],
                prompts: [],
                applications: [],
              });

          return fetchData$.pipe(
            map((results) => {
              const conversations = results.conversations ?? [];
              const prompts = results.prompts ?? [];
              const applications = results.applications ?? [];

              return {
                conversations: conversations.filter(Boolean) as Conversation[],
                prompts: prompts.filter(Boolean) as Prompt[],
                applications: applications.filter(
                  Boolean,
                ) as CustomApplicationModel[],
              };
            }),
            switchMap(({ conversations, prompts, applications }) => {
              const actions: Observable<AppAction>[] = [];

              const updateBasePublicationValues = (entity: ShareEntity) => ({
                name: entity.name,
                publicationInfo: {
                  ...entity.publicationInfo,
                  version: getVersionFromId(entity.id),
                  publicationUrl: url,
                },
              });

              const oldResourcesToClear = oldPublicationResources.filter(
                (oldResource) => {
                  const match = updatedResources.find(
                    (newResource) =>
                      newResource?.sourceUrl === oldResource.sourceUrl,
                  );

                  return match && match.targetUrl !== oldResource.targetUrl;
                },
              );

              if (conversations.length) {
                if (filesToUpdate.length) {
                  const titlesToUpdate = filesToUpdate.map(getLastPathSegment);

                  actions.push(
                    ...conversations.map((conversation) => {
                      return of(
                        ConversationsActions.updateConversation({
                          id: conversation.id,
                          values: {
                            ...updateBasePublicationValues(conversation),
                            messages: updateMessagesAttachmentsTitles(
                              conversation.messages,
                              titlesToUpdate,
                            ),
                            playback: conversation.playback
                              ? {
                                  ...conversation.playback,
                                  messagesStack:
                                    updateMessagesAttachmentsTitles(
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
                          values: updateBasePublicationValues(conversation),
                        }),
                      ),
                    ),
                  );
                }

                // Clear old conversations from state
                const oldConversationResourcesIds = oldResourcesToClear
                  .filter(({ reviewUrl }) => isConversationId(reviewUrl))
                  .map(({ reviewUrl }) => reviewUrl);

                if (oldConversationResourcesIds.length) {
                  const allConversations =
                    ConversationsSelectors.selectConversations(state);
                  const clearedConversationsState = allConversations.filter(
                    ({ id }) => !oldConversationResourcesIds.includes(id),
                  );

                  actions.push(
                    of(
                      ConversationsActions.setConversations({
                        conversations: clearedConversationsState,
                      }),
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
                        values: updateBasePublicationValues(prompt),
                      }),
                    ),
                  ),
                );

                // Clear old prompts from state
                const oldPromptResourcesIds = oldResourcesToClear
                  .filter(({ reviewUrl }) => isPromptId(reviewUrl))
                  .map(({ reviewUrl }) => reviewUrl);

                if (oldPromptResourcesIds.length) {
                  const allPrompts = PromptsSelectors.selectPrompts(state);
                  const clearedPromptsState = allPrompts.filter(
                    ({ id }) => !oldPromptResourcesIds.includes(id),
                  );

                  actions.push(
                    of(
                      PromptsActions.setPrompts({
                        prompts: clearedPromptsState,
                      }),
                    ),
                  );
                }
              }

              if (applications.length) {
                actions.push(
                  ...applications.map((application) => {
                    const newApplication = {
                      ...application,
                      name: parseEntityApiKey(
                        splitEntityId(application.id).name,
                        { parseVersion: true },
                      ).name,
                      version: getVersionFromId(application.id),
                    };

                    return getUpdateApplicationGeneralInfoAction$(
                      application,
                      newApplication,
                    );
                  }),
                );

                // Clear old applications from state
                const oldApplicationResourcesIds = oldResourcesToClear
                  .filter(({ reviewUrl }) => isApplicationId(reviewUrl))
                  .map(({ reviewUrl }) => reviewUrl);

                if (oldApplicationResourcesIds.length) {
                  const allAgents = ModelsSelectors.selectModels(state);
                  const clearedApplicationsState = allAgents.filter(
                    ({ id }) => !oldApplicationResourcesIds.includes(id),
                  );

                  actions.push(
                    of(
                      ModelsActions.setModels({
                        models: clearedApplicationsState,
                      }),
                    ),
                  );
                }
              }

              return concat(
                ...actions,
                getSetUpdatedItemsToApproveAction$(
                  state,
                  oldPublicationResources,
                  updatedResources,
                  url,
                ),
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

      const selectedPublicationItems =
        PublicationSelectors.selectSelectedPublicationItems(
          state,
          selectedPublication.url,
        );
      const selectedCredentialsItems =
        PublicationSelectors.selectSelectedCredentialsItems(
          state,
          selectedPublication.url,
        );
      const filteredResources = selectedPublicationItems.map((reviewUrl) => {
        const resource = selectedPublication.resources.find(
          (r) => r.reviewUrl === reviewUrl,
        );

        if (resource) {
          return {
            ...resource,
            publishCredentials:
              resource.publishCredentials &&
              selectedCredentialsItems.includes(resource.reviewUrl),
            sourceUrl: resource.sourceUrl ?? '',
          };
        }

        // if new resources were added while unpublishing
        return {
          reviewUrl,
          action: PublishActions.DELETE,
          targetUrl: reviewUrl,
          sourceUrl: reviewUrl,
        };
      });

      return PublicationService.updatePublicationRequest({
        url: selectedPublication.url,
        publicationData: {
          ...selectedPublication,
          resources: filteredResources,
        },
      }).pipe(
        switchMap((response) => {
          const resourcesIds = selectedPublication.resources.map(
            (resource) => resource.reviewUrl,
          );
          if (
            selectedPublicationItems.some(
              (item) => !resourcesIds.includes(item),
            )
          ) {
            const existingReviewedResources =
              PublicationSelectors.selectResourcesToReviewByPublicationUrl(
                state$.value,
                selectedPublication.url,
              );

            const prompts = PromptsSelectors.selectPublicPrompts(state);
            const conversations =
              ConversationsSelectors.selectPublicConversations(state);

            const resourcesToDelete = new Set(
              response.resources
                .filter((resource) => resource.action === PublishActions.DELETE)
                .map((resource) => resource.reviewUrl),
            );

            return concat(
              of(
                UIActions.showInfoToast(
                  'New items were added to the publication, please review them before approving',
                ),
              ),
              of(
                PublicationActions.uploadPublicationSuccess({
                  publication: response,
                }),
              ),
              of(
                ConversationsActions.addConversations({
                  conversations: getDeletedEntities(
                    conversations,
                    resourcesToDelete,
                  ),
                }),
              ),
              of(
                PromptsActions.addPrompts({
                  prompts: getDeletedEntities(prompts, resourcesToDelete),
                }),
              ),
              of(
                PublicationActions.setPublicationsToReview({
                  items: response.resources.map((resource) => {
                    const matched = existingReviewedResources.find(
                      (r) => r.sourceUrl === resource.sourceUrl,
                    );
                    return {
                      reviewed: matched?.reviewed ?? false,
                      reviewUrl: resource.reviewUrl,
                      sourceUrl: resource.sourceUrl ?? '',
                    };
                  }),
                  publicationUrl: response.url,
                }),
              ),
            );
          }

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

const updatePublicationAndConversationLastMessageAttachmentsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(
      PublicationActions.updatePublicationAndConversationLastMessageAttachments
        .type,
    ),
    switchMap(({ payload }) => {
      const state = state$.value;

      return addMessageAttachmentsToPublication$(
        payload.message,
        getFolderIdFromEntityId(payload.conversationId),
        payload.publicationUrl,
        state,
      ).pipe(
        switchMap(({ updatedPublication, newItemsToSelect }) => {
          return forkJoin({
            updatedPublication: of(updatedPublication),
            newItemsToSelect: of(newItemsToSelect),
            conversation: getOrUploadConversation(
              {
                id: payload.conversationId,
              },
              state,
            ).pipe(map(({ conversation }) => conversation)),
          });
        }),
        switchMap(({ updatedPublication, newItemsToSelect, conversation }) => {
          if (!conversation) {
            console.error(
              'Conversation not found, cannot update conversation attachments',
            );

            return EMPTY;
          }

          const lastMessage = conversation.messages.at(-1);
          if (!lastMessage) {
            console.error(
              'Last message not found, cannot update conversation attachments',
            );

            return EMPTY;
          }

          const responseResourcesSourceUrls = updatedPublication.resources.map(
            (resource) => resource.sourceUrl,
          );
          const updatedLastMessage = {
            ...lastMessage,
            custom_content: {
              ...lastMessage?.custom_content,
              attachments: lastMessage?.custom_content?.attachments?.map(
                (attachment) =>
                  responseResourcesSourceUrls.includes(attachment.url ?? '')
                    ? {
                        ...attachment,
                        url:
                          updatedPublication.resources.find(
                            (resource) => resource.sourceUrl === attachment.url,
                          )?.reviewUrl ?? attachment.url,
                      }
                    : attachment,
              ),
            },
          };

          return concat(
            of(
              ConversationsActions.updateConversation({
                id: conversation.id,
                values: {
                  ...conversation,
                  isMessageStreaming: false,
                  messages: [
                    ...conversation.messages.slice(0, -1),
                    updatedLastMessage,
                  ],
                },
              }),
            ),
            of(
              PublicationActions.uploadPublication({
                url: updatedPublication.url,
              }),
            ),
            of(
              PublicationActions.setPublicationItems({
                publicationUrl: updatedPublication.url,
                ids: newItemsToSelect,
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

const updatePublicationConversationAttachmentsAndSendMessageEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    ofType(
      PublicationActions.updatePublicationConversationAttachmentsAndSendMessage
        .type,
    ),
    switchMap(({ payload }) => {
      const state = state$.value;
      const { sendMessagePayload, publicationUrl } = payload;

      return addMessageAttachmentsToPublication$(
        sendMessagePayload.message,
        sendMessagePayload.conversation.folderId,
        publicationUrl,
        state,
      ).pipe(
        switchMap(({ updatedPublication, newItemsToSelect }) => {
          const newSendMessagePayload = {
            ...sendMessagePayload,
            message: {
              ...sendMessagePayload.message,
              custom_content: {
                ...sendMessagePayload.message.custom_content,
                attachments:
                  sendMessagePayload.message.custom_content?.attachments?.map(
                    (attachment) => {
                      const attachmentUrl = ApiUtils.decodeApiUrl(
                        attachment.url ?? '',
                      );
                      const addedResource = updatedPublication.resources.find(
                        ({ sourceUrl }) => sourceUrl === attachmentUrl,
                      );

                      if (
                        !isMyEntity({ id: attachmentUrl }) ||
                        !addedResource
                      ) {
                        return attachment;
                      }

                      return {
                        ...attachment,
                        url: ApiUtils.encodeApiUrl(addedResource.reviewUrl),
                      };
                    },
                  ),
              },
            },
          };

          return concat(
            of(ConversationsActions.sendMessage(newSendMessagePayload)),
            of(PublicationActions.uploadPublication({ url: publicationUrl })),
            of(
              PublicationActions.setPublicationItems({
                publicationUrl,
                ids: newItemsToSelect,
              }),
            ),
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
      const state = state$.value;
      const publication = PublicationSelectors.selectSelectedPublication(state);
      const resources = publication?.resources;

      if (!publication) {
        console.error('Publication not found, cannot select items to approve');
        return EMPTY;
      }

      const selectedPublicationItems =
        PublicationSelectors.selectAllSelectedPublicationItems(state);

      if (selectedPublicationItems[publication.url] !== undefined) {
        return EMPTY;
      }

      return of(
        PublicationActions.setPublicationItems({
          publicationUrl: publication.url,
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
  updatePublicationConversationAttachmentsAndSendMessageEpic,
  updatePublicationAndConversationLastMessageAttachmentsEpic,
  updatePublicationRequestAndApplicationIconEpic,
  updateApplicationPublicationUrlsEpic,

  // on select publication
  onSelectPublicationEffectEpic,
);
