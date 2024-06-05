import {
  EMPTY,
  Observable,
  catchError,
  concat,
  filter,
  from,
  iif,
  map,
  mergeAll,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { PublicationService } from '@/src/utils/app/data/publication-service';
import { constructPath } from '@/src/utils/app/file';
import {
  getFolderFromId,
  getFolderIdFromEntityId,
  getParentFolderIdsFromEntityId,
  getRootFolderIdFromEntityId,
  splitEntityId,
} from '@/src/utils/app/folders';
import {
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

import {
  BackendDataNodeType,
  FeatureType,
  UploadStatus,
} from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { PublishActions } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { FilesActions } from '../files/files.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from './publication.reducers';

import entries from 'lodash-es/entries';
import maxBy from 'lodash-es/maxBy';
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

      return PublicationService.publish({
        targetFolder: `${constructPath('public', encodedTargetFolder)}/`,
        resources: payload.resources.map((r) => ({
          action: PublishActions.ADD,
          sourceUrl: ApiUtils.encodeApiUrl(r.sourceUrl),
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
          const actions: Observable<AnyAction>[] = [];
          const promptResources = publication.resources.filter((r) =>
            isPromptId(r.targetUrl),
          );
          const unpublishResources = publication.resources.filter(
            (r) => r.action === PublishActions.DELETE,
          );

          if (unpublishResources.length) {
            const rootFolderPaths = uniq(
              unpublishResources.map((r) =>
                getRootFolderIdFromEntityId(r.reviewUrl),
              ),
            );

            actions.push(
              from(
                rootFolderPaths.map((path) => {
                  const actionCreator = isConversationId(path)
                    ? ConversationsActions.uploadConversationsWithFoldersRecursive
                    : PromptsActions.uploadPromptsWithFoldersRecursive;

                  return of(actionCreator({ noLoader: true, path }));
                }),
              ).pipe(mergeAll()),
            );
          }

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
                        id: r.reviewUrl,
                        folderId: getFolderIdFromEntityId(r.reviewUrl),
                        model: parsedApiKey.model,
                        name: parsedApiKey.name,
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
                  uploadStatus: UploadStatus.LOADED,
                },
              }),
            ),
            of(PublicationActions.selectPublication({ publication })),
            ...actions,
          );
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
    filter(PublicationActions.uploadPublicationsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationUploadFailed),
      ),
    ),
  );

const deletePublicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.deletePublication.match),
    switchMap(({ payload }) => {
      const encodedTargetFolder = ApiUtils.encodeApiUrl(payload.targetFolder);
      const targetFolderSuffix = payload.targetFolder ? '/' : '';

      return PublicationService.deletePublication({
        targetFolder: `${encodedTargetFolder}${targetFolderSuffix}`,
        resources: payload.resources.map((r) => ({
          action: PublishActions.DELETE,
          targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
        })),
      }).pipe(
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.deletePublicationFail());
        }),
      );
    }),
  );

const deletePublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.deletePublicationFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publicationDeletionFailed),
      ),
    ),
  );

const uploadPublishedWithMeItemsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedWithMeItems.match),
    mergeMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        mergeMap((publications) => {
          const actions: Observable<AnyAction>[] = [];
          const selectedIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const pathsToUpload = selectedIds.filter((id) =>
            id.startsWith(
              `${getRootId({ featureType: FeatureType.Chat, bucket: 'public' })}/`,
            ),
          );

          if (pathsToUpload.length) {
            const rootFolderIds = uniq(
              pathsToUpload.map((path) => getRootFolderIdFromEntityId(path)),
            );

            rootFolderIds.forEach((path) =>
              actions.push(
                of(
                  ConversationsActions.uploadConversationsWithFoldersRecursive({
                    path,
                    noLoader: true,
                  }),
                ),
              ),
            );
          }

          if (!publications.items) {
            return EMPTY;
          }

          if (payload.featureType === FeatureType.Chat) {
            const folderTypeEntities = publications.items.filter(
              (item) => item.nodeType === BackendDataNodeType.FOLDER,
            );

            if (folderTypeEntities.length) {
              actions.push(
                of(
                  ConversationsActions.addFolders({
                    folders: folderTypeEntities.map((item) => {
                      const newUrl = ApiUtils.decodeApiUrl(
                        item.url.slice(0, -1),
                      );

                      return {
                        name: item.name,
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

            const itemTypeEntities = publications.items.filter(
              (item) => item.nodeType === BackendDataNodeType.ITEM,
            );

            if (itemTypeEntities) {
              actions.push(
                of(
                  ConversationsActions.addConversations({
                    conversations: itemTypeEntities.map((item) => {
                      const decodedUrl = ApiUtils.decodeApiUrl(item.url);
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(decodedUrl).name,
                      );

                      return {
                        id: decodedUrl,
                        folderId: getFolderIdFromEntityId(decodedUrl),
                        model: parsedApiKey.model,
                        name: parsedApiKey.name,
                        publishedWithMe: true,
                      };
                    }),
                  }),
                ),
              );
            }
          } else if (payload.featureType === FeatureType.Prompt) {
            const folderTypeEntities = publications.items.filter(
              (item) => item.nodeType === BackendDataNodeType.FOLDER,
            );

            if (folderTypeEntities.length) {
              actions.push(
                of(
                  PromptsActions.addFolders({
                    folders: folderTypeEntities.map((item) => {
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

            const itemTypeEntities = publications.items.filter(
              (item) => item.nodeType === BackendDataNodeType.ITEM,
            );

            if (itemTypeEntities.length) {
              actions.push(
                of(
                  PromptsActions.addPrompts({
                    prompts: itemTypeEntities.map((item) => {
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
        translate(errorsMessages.publishedConversationsUploadFailed),
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
          const publication = PublicationSelectors.selectSelectedPublication(
            state$.value,
          );

          if (!publication) {
            return of(PublicationActions.approvePublicationFail());
          }

          const conversationResources = publication.resources.filter((r) =>
            isConversationId(r.targetUrl),
          );

          if (conversationResources.length) {
            const conversationPaths = uniq(
              conversationResources.flatMap((resource) =>
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
                    conversations: conversationResources.map((item) => {
                      const parsedApiKey = parseConversationApiKey(
                        splitEntityId(item.targetUrl).name,
                      );
                      const folderId = getFolderIdFromEntityId(item.targetUrl);

                      return {
                        id: item.targetUrl,
                        folderId,
                        model: parsedApiKey.model,
                        name: parsedApiKey.name,
                        publishedWithMe: isRootId(folderId),
                      };
                    }),
                  }),
                ),
              ),
            );
          }

          const promptResources = publication.resources.filter((r) =>
            isPromptId(r.targetUrl),
          );

          if (promptResources.length) {
            const promptPaths = uniq(
              promptResources.flatMap((resource) =>
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
                    prompts: promptResources.map((item) => {
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
        switchMap(({ rules }) => {
          const currentRulePath = `${constructPath('public', payload.path)}/`;

          if (!rules[currentRulePath] && payload.path) {
            const longestEntry = maxBy(entries(rules), ([key]) => key.length);

            if (longestEntry) {
              // value [1] is the rule
              rules[currentRulePath] = longestEntry[1];
            }
          }

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

export const PublicationEpics = combineEpics(
  initEpic,
  publishEpic,
  publishFailEpic,
  uploadPublicationsEpic,
  uploadPublicationsFailEpic,
  uploadPublicationEpic,
  uploadPublicationFailEpic,
  deletePublicationEpic,
  deletePublicationFailEpic,
  uploadPublishedWithMeItemsEpic,
  uploadPublishedWithMeItemsFailEpic,
  approvePublicationEpic,
  approvePublicationFailEpic,
  rejectPublicationEpic,
  rejectPublicationFailEpic,
  resolvePublicationSuccessEpic,
  uploadRulesEpic,
  uploadRulesFailEpic,
);
