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

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
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
  splitEntityId,
} from '@/src/utils/app/folders';
import {
  getConversationRootId,
  getPromptRootId,
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
  isRootId,
} from '@/src/utils/app/id';
import {
  isEntityPublic,
  mapPublishedItems,
} from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';
import {
  ApiUtils,
  getPublicItemIdWithoutVersion,
  parseConversationApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { EntityType, FeatureType } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';
import { PublishedFileItem } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { NA_VERSION, PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { AuthSelectors } from '../auth/auth.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { FilesActions } from '../files/files.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { PromptsActions, PromptsSelectors } from '../prompts/prompts.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from './publication.reducers';

import {
  ConversationInfo,
  Feature,
  PublishActions,
  UploadStatus,
} from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.init.match),
    switchMap(() => {
      const actions: Observable<AnyAction>[] = [];
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
      );
    }),
  );

const publishEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.publish.match),
    switchMap(({ payload }) => {
      const fileIds = payload.resources
        .map(({ sourceUrl }) => sourceUrl)
        .filter((id) => id && isFileId(id));
      const userBucket = BucketService.getBucket();

      const isPublishingExternalFiles = fileIds.some((id) => {
        const { bucket: fileBucket } = splitEntityId(id as string);

        return fileBucket !== userBucket;
      });

      if (isPublishingExternalFiles) {
        return of(
          PublicationActions.publishFail(
            errorsMessages.publicationWithExternalFilesFailed,
          ),
        );
      }

      return PublicationService.createPublicationRequest(payload).pipe(
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
    filter(PublicationActions.publishFail.match),
    map(({ payload }) => {
      return UIActions.showErrorToast(
        translate(payload ?? errorsMessages.publicationFailed),
      );
    }),
  );

const uploadPublicationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublications.match),
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
    filter(PublicationActions.uploadPublicationsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationsUploadFailed),
      ),
    ),
  );

const uploadPublicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublication.match),
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

          return forkJoin({
            publication: of(publication),
            uploadedUnpublishEntities: of([]),
            unpublishResources: of([]),
          });
        }),
        switchMap(
          ({ publication, uploadedUnpublishEntities, unpublishResources }) => {
            const actions: Observable<AnyAction>[] = [];

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
                        ...getFolderFromId(path, FolderType.Chat),
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
                        ...getFolderFromId(path, FolderType.Prompt),
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
                      ...getFolderFromId(path, FolderType.Prompt),
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
                        },
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
                      ...getFolderFromId(path, FolderType.Chat),
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

              actions.push(
                of(
                  FilesActions.getFoldersSuccess({
                    folders: filePaths.map((path) => ({
                      ...getFolderFromId(path, FolderType.File),
                      status: UploadStatus.LOADED,
                      isPublicationFolder: true,
                    })),
                  }),
                ),
                of(
                  FilesActions.getFilesSuccess({
                    files: fileResources.map((r) => ({
                      id: r.reviewUrl,
                      folderId: getFolderIdFromEntityId(r.reviewUrl),
                      name: splitEntityId(r.targetUrl).name,
                      contentLength: 0,
                      contentType: '',
                      isPublicationFile: true,
                      publicationInfo: {
                        action: r.action,
                        publicationUrl: payload.url,
                      },
                    })),
                  }),
                ),
              );
            }

            return concat(
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
    filter(PublicationActions.uploadPublicationsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationUploadFailed),
      ),
    ),
  );

const uploadPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedWithMeItems.match),
    filter(({ payload }) =>
      SettingsSelectors.selectIsPublishingEnabled(
        state$.value,
        payload.featureType,
      ),
    ),
    mergeMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        mergeMap(({ folders, items }) => {
          const actions: Observable<AnyAction>[] = [];
          const selectedIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const selectedConversationsToUpload = selectedIds
            // do not upload root entities, as they uploaded with listing
            .filter((id) => id.split('/').length > 3)
            .filter((id) => isEntityPublic({ id }));
          const publicationItemIds = items.map((item) => item.url);

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
                      type: FolderType.Chat,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              const { publicVersionGroups, items: conversations } =
                mapPublishedItems<ConversationInfo>(
                  publicationItemIds,
                  payload.featureType,
                );

              actions.push(
                of(
                  PublicationActions.addPublicVersionGroups({
                    publicVersionGroups,
                  }),
                ),
              );
              actions.push(
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
                      type: FolderType.Prompt,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              const { publicVersionGroups, items: prompts } =
                mapPublishedItems<PromptInfo>(
                  publicationItemIds,
                  payload.featureType,
                );

              actions.push(
                of(
                  PublicationActions.addPublicVersionGroups({
                    publicVersionGroups,
                  }),
                ),
              );
              actions.push(
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
                      type: FolderType.File,
                    })),
                  }),
                ),
              );
            }

            if (items.length) {
              actions.push(
                of(
                  FilesActions.getFilesSuccess({
                    files: (items as PublishedFileItem[]).map((item) => {
                      const decodedUrl = ApiUtils.decodeApiUrl(item.url);
                      const { apiKey, bucket, parentPath, name } =
                        splitEntityId(decodedUrl);

                      return {
                        contentLength: item.contentLength,
                        contentType: item.contentType,
                        absolutePath: constructPath(apiKey, bucket, parentPath),
                        id: decodedUrl,
                        folderId: getFolderIdFromEntityId(decodedUrl),
                        name,
                        publishedWithMe: true,
                      };
                    }),
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
    filter(PublicationActions.uploadPublishedWithMeItemsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedItemsUploadFailed),
      ),
    ),
  );

const approvePublicationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.approvePublication.match),
    switchMap(({ payload }) =>
      PublicationService.approvePublication(payload.url).pipe(
        switchMap(() => {
          const actions: Observable<AnyAction>[] = [];
          const selectedPublication =
            PublicationSelectors.selectSelectedPublication(state$.value);

          if (!selectedPublication) {
            return of(PublicationActions.approvePublicationFail());
          }

          const conversationResources = selectedPublication.resources.filter(
            (r) => isConversationId(r.targetUrl),
          );
          const conversationResourcesToPublish = conversationResources.filter(
            (r) => r.action === PublishActions.ADD,
          );
          const conversationResourcesToUnpublish = conversationResources.filter(
            (r) => r.action === PublishActions.DELETE,
          );

          if (conversationResourcesToUnpublish.length) {
            const allConversations = ConversationsSelectors.selectConversations(
              state$.value,
            );
            const allFolders = ConversationsSelectors.selectFolders(
              state$.value,
            );
            const conversationsToRemove = conversationResourcesToUnpublish.map(
              (r) => r.reviewUrl,
            );
            const filteredConversations = allConversations.filter(
              (c) => !conversationsToRemove.includes(c.id),
            );
            const filteredFolders = allFolders.filter(
              (f) =>
                f.status !== UploadStatus.LOADED ||
                !f.id.startsWith(getConversationRootId(PUBLIC_URL_PREFIX)) ||
                (filteredConversations.some((c) =>
                  c.id.startsWith(`${f.id}/`),
                ) &&
                  f.id.startsWith(getConversationRootId(PUBLIC_URL_PREFIX))),
            );
            const versionGroups = uniq(
              conversationsToRemove.map((id) => {
                const parsedApiKey = parseConversationApiKey(
                  splitEntityId(id).name,
                  { parseVersion: true },
                );

                return getPublicItemIdWithoutVersion(
                  parsedApiKey.publicationInfo?.version ?? NA_VERSION,
                  id,
                );
              }),
            );

            actions.push(
              of(
                ConversationsActions.setConversations({
                  conversations: filteredConversations,
                }),
              ),
              of(
                ConversationsActions.setFolders({
                  folders: filteredFolders,
                }),
              ),
              of(
                PublicationActions.removePublicVersionGroups({
                  groupsToRemove: versionGroups.map((groupId) => ({
                    groupIds: conversationsToRemove.filter((id) => {
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(id).name,
                        { parseVersion: true },
                      );

                      return (
                        getPublicItemIdWithoutVersion(
                          parsedApiKey.publicationInfo?.version ?? NA_VERSION,
                          id,
                        ) === groupId
                      );
                    }),
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
                ).filter((p) => p !== resource.targetUrl),
              ),
            );

            const { publicVersionGroups, items } =
              mapPublishedItems<ConversationInfo>(
                conversationResourcesToPublish.map(
                  (resource) => resource.targetUrl,
                ),
                FeatureType.Chat,
              );

            actions.push(
              of(
                ConversationsActions.addFolders({
                  folders: conversationPaths.map((path) => ({
                    ...getFolderFromId(path, FolderType.Chat),
                    status: UploadStatus.LOADED,
                    publishedWithMe: path.split('/').length === 3,
                  })),
                }),
              ),
              of(
                ConversationsActions.addConversations({
                  conversations: items,
                }),
              ),
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          const promptResources = selectedPublication.resources.filter((r) =>
            isPromptId(r.targetUrl),
          );
          const promptResourcesToPublish = promptResources.filter(
            (r) => r.action === PublishActions.ADD,
          );
          const promptResourcesToUnpublish = promptResources.filter(
            (r) => r.action === PublishActions.DELETE,
          );

          if (promptResourcesToUnpublish.length) {
            const allPrompts = PromptsSelectors.selectPrompts(state$.value);
            const promptsToRemove = promptResourcesToUnpublish.map(
              (r) => r.reviewUrl,
            );
            const allFolders = PromptsSelectors.selectFolders(state$.value);
            const filteredPrompts = allPrompts.filter(
              (p) => !promptsToRemove.includes(p.id),
            );
            const filteredFolders = allFolders.filter(
              (f) =>
                f.status !== UploadStatus.LOADED ||
                !f.id.startsWith(getPromptRootId(PUBLIC_URL_PREFIX)) ||
                (filteredPrompts.some((c) => c.id.startsWith(`${f.id}/`)) &&
                  f.id.startsWith(getPromptRootId(PUBLIC_URL_PREFIX))),
            );
            const versionGroups = uniq(
              promptsToRemove.map((id) => {
                const parsedApiKey = parsePromptApiKey(splitEntityId(id).name, {
                  parseVersion: true,
                });

                return getPublicItemIdWithoutVersion(
                  parsedApiKey.publicationInfo?.version ?? NA_VERSION,
                  id,
                );
              }),
            );

            actions.push(
              of(
                PromptsActions.setPrompts({
                  prompts: filteredPrompts,
                }),
              ),
              of(
                PromptsActions.setFolders({
                  folders: filteredFolders,
                }),
              ),
              of(
                PublicationActions.removePublicVersionGroups({
                  groupsToRemove: versionGroups.map((groupId) => ({
                    groupIds: promptsToRemove.filter((id) => {
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(id).name,
                        { parseVersion: true },
                      );

                      return (
                        getPublicItemIdWithoutVersion(
                          parsedApiKey.publicationInfo?.version ?? NA_VERSION,
                          id,
                        ) === groupId
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
                ).filter((p) => p !== resource.targetUrl),
              ),
            );

            const { publicVersionGroups, items } =
              mapPublishedItems<PromptInfo>(
                promptResourcesToPublish.map((resource) => resource.targetUrl),
                FeatureType.Prompt,
              );

            actions.push(
              of(
                PromptsActions.addFolders({
                  folders: promptPaths.map((path) => ({
                    ...getFolderFromId(path, FolderType.Prompt),
                    status: UploadStatus.LOADED,
                    publishedWithMe: path.split('/').length === 3,
                  })),
                }),
              ),
              of(
                PromptsActions.addPrompts({
                  prompts: items,
                }),
              ),
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          return concat(
            ...actions,
            of(
              PublicationActions.approvePublicationSuccess({
                url: payload.url,
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
    filter(PublicationActions.approvePublicationFail.match),
    map(({ payload }) =>
      UIActions.showErrorToast(
        translate(payload ?? errorsMessages.publicationApproveFailed),
      ),
    ),
  );

const rejectPublicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.rejectPublication.match),
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
    filter(PublicationActions.rejectPublicationFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationRejectFailed),
      ),
    ),
  );

const resolvePublicationSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PublicationActions.rejectPublicationSuccess.match(action) ||
        PublicationActions.approvePublicationSuccess.match(action),
    ),
    switchMap(() => {
      const publications = PublicationSelectors.selectPublications(
        state$.value,
      );

      if (!publications.length) {
        const conversations = ConversationsSelectors.selectConversations(
          state$.value,
        );

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
    filter(PublicationActions.uploadRules.match),
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
    filter(PublicationActions.uploadRulesFail.match),
    map(({ payload }) =>
      UIActions.showErrorToast(
        translate(payload ?? errorsMessages.rulesUploadingFailed),
      ),
    ),
  );

const uploadAllPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadAllPublishedWithMeItems.match),
    filter(({ payload }) =>
      SettingsSelectors.selectIsPublishingEnabled(
        state$.value,
        payload.featureType,
      ),
    ),
    mergeMap(({ payload }) => {
      const isAllItemsUploaded = PublicationSelectors.selectIsAllItemsUploaded(
        state$.value,
        payload.featureType,
      );

      if (isAllItemsUploaded) {
        return EMPTY;
      }

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

          const actions: Observable<AnyAction>[] = [];
          const publicationItemIds = publications.items.map((item) => item.url);
          const paths = uniq(
            publicationItemIds.flatMap((id) =>
              getParentFolderIdsFromFolderId(getFolderIdFromEntityId(id)),
            ),
          );
          const folders = getFoldersFromIds(
            paths,
            payload.featureType === FeatureType.Chat
              ? FolderType.Chat
              : FolderType.Prompt,
            UploadStatus.LOADED,
          ).map((folder) => ({
            ...folder,
            publishedWithMe: isRootId(getFolderIdFromEntityId(folder.id)),
          }));

          if (payload.featureType === FeatureType.Chat) {
            const { publicVersionGroups, items: conversations } =
              mapPublishedItems<ConversationInfo>(
                publicationItemIds,
                payload.featureType,
              );

            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
            actions.push(
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
                publicationItemIds,
                payload.featureType,
              );

            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
            actions.push(
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
    filter(PublicationActions.uploadAllPublishedWithMeItemsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedItemsUploadFailed),
      ),
    ),
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

  // handle publications
  approvePublicationEpic,
  approvePublicationFailEpic,
  rejectPublicationEpic,
  rejectPublicationFailEpic,
  resolvePublicationSuccessEpic,

  // upload rules
  uploadRulesEpic,
  uploadRulesFailEpic,
);
