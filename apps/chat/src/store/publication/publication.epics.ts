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

import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
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
  getRootId,
  isConversationId,
  isFileId,
  isPromptId,
  isRootId,
} from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';
import {
  ApiUtils,
  parseConversationApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { PublishActions, PublishedFileItem } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';
import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { FilesActions } from '../files/files.reducers';
import { PromptsActions, PromptsSelectors } from '../prompts/prompts.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from './publication.reducers';

import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.init.match),
    switchMap(() => of(PublicationActions.uploadPublications())),
  );

const publishEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.publish.match),
    switchMap(({ payload }) => {
      const encodedTargetFolder = ApiUtils.encodeApiUrl(payload.targetFolder);
      const targetFolderSuffix = payload.targetFolder ? '/' : '';

      return PublicationService.createPublicationRequest({
        name: payload.name,
        targetFolder: `${encodedTargetFolder}${targetFolderSuffix}`,
        resources: payload.resources.map((r) => ({
          action: payload.action,
          sourceUrl: r.sourceUrl
            ? ApiUtils.encodeApiUrl(r.sourceUrl)
            : undefined,
          targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
        })),
        rules: payload.rules,
      }).pipe(
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.publishFail());
        }),
      );
    }),
  );

const publishFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.publishFail.match),
    map(() =>
      UIActions.showErrorToast(translate(errorsMessages.publicationFailed)),
    ),
  );

const uploadPublicationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublications.match),
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

const uploadPublicationEpic: AppEpic = (action$) =>
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
                  concat(
                    of(
                      ConversationsActions.addConversations({
                        conversations: conversationUnpublishEntities.map(
                          (r) => {
                            const parsedApiKey = parseConversationApiKey(
                              splitEntityId(r.targetUrl).name,
                            );

                            return {
                              ...parsedApiKey,
                              id: r.reviewUrl,
                              folderId: getFolderIdFromEntityId(r.reviewUrl),
                              publicationInfo: {
                                action: r.action,
                                isNotExist:
                                  !uploadedUnpublishEntitiesIds.includes(
                                    r.reviewUrl,
                                  ),
                              },
                            };
                          },
                        ),
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
                  concat(
                    of(
                      PromptsActions.addPrompts({
                        prompts: promptUnpublishEntities.map((r) => {
                          const parsedApiKey = parsePromptApiKey(
                            splitEntityId(r.targetUrl).name,
                          );

                          return {
                            id: r.reviewUrl,
                            folderId: getFolderIdFromEntityId(r.reviewUrl),
                            name: parsedApiKey.name,
                            publicationInfo: {
                              action: r.action,
                              isNotExist:
                                !uploadedUnpublishEntitiesIds.includes(
                                  r.reviewUrl,
                                ),
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
                concat(
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
                        );

                        return {
                          id: r.reviewUrl,
                          folderId: getFolderIdFromEntityId(r.reviewUrl),
                          name: parsedApiKey.name,
                          publicationInfo: {
                            action: r.action,
                          },
                        };
                      }),
                    }),
                  ),
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
                concat(
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
                        );

                        return {
                          ...parsedApiKey,
                          id: r.reviewUrl,
                          folderId: getFolderIdFromEntityId(r.reviewUrl),
                          publicationInfo: {
                            action: r.action,
                          },
                        };
                      }),
                    }),
                  ),
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
                concat(
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
                        },
                      })),
                    }),
                  ),
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
              of(
                PublicationActions.selectPublication({
                  publication: {
                    ...publication,
                    resources: publication.resources,
                  },
                }),
              ),
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
    mergeMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        mergeMap(({ folders, items }) => {
          const actions: Observable<AnyAction>[] = [];
          const selectedIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const selectedConversationsToUpload = selectedIds
            // do not upload root entities, as they uploaded with listing
            .filter((id) => id.split('/').length > 3)
            .filter((id) =>
              id.startsWith(
                `${getRootId({ featureType: FeatureType.Chat, bucket: PUBLIC_URL_PREFIX })}/`,
              ),
            );

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
                    folders: folders.map((folder) => {
                      const newUrl = ApiUtils.decodeApiUrl(
                        folder.url.slice(0, -1),
                      );

                      return {
                        name: folder.name,
                        id: newUrl,
                        folderId: getFolderIdFromEntityId(newUrl),
                        publishedWithMe: true,
                        type: FolderType.Chat,
                      };
                    }),
                  }),
                ),
              );
            }

            if (items.length) {
              actions.push(
                of(
                  ConversationsActions.addConversations({
                    conversations: items.map((item) => {
                      const decodedUrl = ApiUtils.decodeApiUrl(item.url);
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(decodedUrl).name,
                      );

                      return {
                        ...parsedApiKey,
                        id: decodedUrl,
                        folderId: getFolderIdFromEntityId(decodedUrl),
                        publishedWithMe: true,
                      };
                    }),
                  }),
                ),
              );
            }
          } else if (payload.featureType === FeatureType.Prompt) {
            if (folders.length) {
              actions.push(
                of(
                  PromptsActions.addFolders({
                    folders: folders.map((item) => {
                      const newUrl = ApiUtils.decodeApiUrl(
                        item.url.slice(0, -1),
                      );

                      return {
                        name: item.name,
                        id: newUrl,
                        folderId: getFolderIdFromEntityId(newUrl),
                        publishedWithMe: true,
                        type: FolderType.Prompt,
                      };
                    }),
                  }),
                ),
              );
            }

            if (items.length) {
              actions.push(
                of(
                  PromptsActions.addPrompts({
                    prompts: items.map((item) => {
                      const decodedUrl = ApiUtils.decodeApiUrl(item.url);
                      const parsedApiKey = parsePromptApiKey(
                        splitEntityId(decodedUrl).name,
                      );

                      return {
                        id: decodedUrl,
                        folderId: getFolderIdFromEntityId(decodedUrl),
                        name: parsedApiKey.name,
                        publishedWithMe: true,
                      };
                    }),
                  }),
                ),
              );
            }
          } else if (payload.featureType === FeatureType.File) {
            if (folders.length) {
              actions.push(
                of(
                  FilesActions.getFoldersSuccess({
                    folders: folders.map((item) => {
                      const newUrl = ApiUtils.decodeApiUrl(
                        item.url.slice(0, -1),
                      );

                      return {
                        name: item.name,
                        id: newUrl,
                        folderId: getFolderIdFromEntityId(newUrl),
                        publishedWithMe: true,
                        type: FolderType.File,
                      };
                    }),
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
                      const parsedApiKey = parsePromptApiKey(
                        splitEntityId(decodedUrl).name,
                      );
                      return {
                        contentLength: item.contentLength,
                        contentType: item.contentType,
                        id: decodedUrl,
                        folderId: getFolderIdFromEntityId(decodedUrl),
                        name: parsedApiKey.name,
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

            actions.push(
              of(
                ConversationsActions.setConversations({
                  conversations: filteredConversations,
                }),
              ),
            );
            actions.push(
              of(
                ConversationsActions.setFolders({
                  folders: filteredFolders,
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

            actions.push(
              concat(
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
                    conversations: conversationResourcesToPublish.map(
                      (item) => {
                        const parsedApiKey = parseConversationApiKey(
                          splitEntityId(item.targetUrl).name,
                        );
                        const folderId = getFolderIdFromEntityId(
                          item.targetUrl,
                        );

                        return {
                          ...parsedApiKey,
                          id: item.targetUrl,
                          folderId,
                          publishedWithMe: isRootId(folderId),
                        };
                      },
                    ),
                  }),
                ),
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

            actions.push(
              of(
                PromptsActions.setPrompts({
                  prompts: filteredPrompts,
                }),
              ),
            );
            actions.push(
              of(
                ConversationsActions.setFolders({
                  folders: filteredFolders,
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

            actions.push(
              concat(
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
                    prompts: promptResourcesToPublish.map((item) => {
                      const parsedApiKey = parsePromptApiKey(
                        splitEntityId(item.targetUrl).name,
                      );
                      const folderId = getFolderIdFromEntityId(item.targetUrl);

                      return {
                        id: item.targetUrl,
                        folderId,
                        name: parsedApiKey.name,
                        publishedWithMe: isRootId(folderId),
                      };
                    }),
                  }),
                ),
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
          return of(PublicationActions.approvePublicationFail());
        }),
      ),
    ),
  );

const approvePublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.approvePublicationFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationApproveFailed),
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
          return of(PublicationActions.uploadRulesFail());
        }),
      ),
    ),
  );

const uploadRulesFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadRulesFail.match),
    map(() =>
      UIActions.showErrorToast(translate(errorsMessages.rulesUploadingFailed)),
    ),
  );

const uploadAllPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadAllPublishedWithMeItems.match),
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

          const paths = uniq(
            publications.items.flatMap((c) =>
              getParentFolderIdsFromFolderId(getFolderIdFromEntityId(c.url)),
            ),
          ).map((path) => ApiUtils.decodeApiUrl(path));
          const items = publications.items.map((item) => {
            const id = ApiUtils.decodeApiUrl(item.url);
            const parsedApiKey = parseConversationApiKey(
              splitEntityId(id).name,
            );
            const folderId = getFolderIdFromEntityId(id);

            return {
              ...parsedApiKey,
              id,
              folderId: folderId,
              publishedWithMe: isRootId(folderId),
            };
          });
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
            actions.push(
              of(
                ConversationsActions.uploadChildConversationsWithFoldersSuccess(
                  {
                    parentIds: paths,
                    folders,
                    conversations: items,
                  },
                ),
              ),
            );
          } else if (payload.featureType === FeatureType.Prompt) {
            actions.push(
              of(
                PromptsActions.uploadChildPromptsWithFoldersSuccess({
                  parentIds: paths,
                  folders,
                  prompts: items,
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
