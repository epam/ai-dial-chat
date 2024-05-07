import {
  Observable,
  catchError,
  concat,
  filter,
  ignoreElements,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import {
  getFolderFromId,
  getFolderIdFromEntityId,
  getParentFolderIdsFromEntityId,
  splitEntityId,
} from '@/src/utils/app/folders';
import { isConversationId, isPromptId, isRootId } from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';
import {
  ApiUtils,
  parseConversationApiKey,
  parsePromptApiKey,
} from '@/src/utils/server/api';

import { ApiKeys, BackendDataNodeType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { PublicationRequest } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { ConversationsActions } from '../conversations/conversations.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from './publication.reducers';

import { uniq } from 'lodash-es';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.init.match),
    switchMap(() =>
      of(PublicationActions.uploadPublications({ asAdmin: true })),
    ),
  );

const publishEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.publish.match),
    switchMap(({ payload }) => {
      const publicationRequestInfo: PublicationRequest = {
        url: `publications/${BucketService.getBucket()}/`,
        targetUrl: `public/${payload.targetFolder}`,
        resources: payload.resources.map((r) => ({
          sourceUrl: ApiUtils.encodeApiUrl(r.sourceUrl),
          targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
        })),
        rules: payload.rules,
      };

      return PublicationService.publish(publicationRequestInfo).pipe(
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.publishFail());
        }),
        ignoreElements(),
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
    switchMap(({ payload }) =>
      PublicationService.publicationList(
        payload.asAdmin
          ? `publications/public/`
          : `publications/${BucketService.getBucket()}/${payload?.url ?? ''}`,
      ).pipe(
        switchMap(({ publications }) =>
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
            isPromptId(r.reviewUrl),
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
                  ConversationsActions.addFolders({
                    folders: promptPaths.map((path) => ({
                      ...getFolderFromId(path, FolderType.Prompt),
                      status: UploadStatus.LOADED,
                      publishedWithMe: true,
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
            isConversationId(r.reviewUrl),
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
                      publishedWithMe: true,
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

          return concat(
            of(PublicationActions.uploadPublicationSuccess({ publication })),
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
    switchMap(({ payload }) =>
      PublicationService.deletePublication(payload.url).pipe(
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.deletePublicationFail());
        }),
      ),
    ),
    ignoreElements(),
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

const uploadPublishedWithMeItemsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedWithMeItems.match),
    mergeMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        mergeMap((publications) => {
          const actions: Observable<AnyAction>[] = [];

          if (
            payload.featureType === ApiKeys.Conversations &&
            publications.items
          ) {
            actions.push(
              ...publications.items.map((item) => {
                if (item.nodeType === BackendDataNodeType.FOLDER) {
                  const newUrl = item.url.slice(0, -1);

                  return of(
                    ConversationsActions.addFolders({
                      folders: [
                        {
                          name: item.name,
                          id: newUrl,
                          folderId: getFolderIdFromEntityId(newUrl),
                          publishedWithMe: true,
                          type: FolderType.Chat,
                        },
                      ],
                    }),
                  );
                }

                const parsedApiKey = parseConversationApiKey(
                  splitEntityId(item.url).name,
                );

                return of(
                  ConversationsActions.addConversations({
                    conversations: [
                      {
                        id: item.url,
                        folderId: getFolderIdFromEntityId(item.url),
                        model: parsedApiKey.model,
                        name: parsedApiKey.name,
                        publishedWithMe: true,
                      },
                    ],
                  }),
                );
              }),
            );
          } else if (
            payload.featureType === ApiKeys.Prompts &&
            publications.items
          ) {
            actions.push(
              ...publications.items.map((item) => {
                if (item.nodeType === BackendDataNodeType.FOLDER) {
                  const newUrl = item.url.slice(0, -1);

                  return of(
                    PromptsActions.addFolders({
                      folders: [
                        {
                          name: item.name,
                          id: newUrl,
                          folderId: getFolderIdFromEntityId(newUrl),
                          publishedWithMe: true,
                          type: FolderType.Prompt,
                        },
                      ],
                    }),
                  );
                }

                return of(
                  PromptsActions.addPrompts({
                    prompts: [
                      {
                        id: item.url,
                        folderId: getFolderIdFromEntityId(item.url),
                        name: splitEntityId(item.url).name,
                        publishedWithMe: true,
                      },
                    ],
                  }),
                );
              }),
            );
          }

          return concat(
            of(
              PublicationActions.uploadPublishedWithMeItemsSuccess({
                publishedItems: publications,
              }),
            ),
            ...actions,
          );
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
            isConversationId(r.reviewUrl),
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
                      publishedWithMe: true,
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
            isPromptId(r.reviewUrl),
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
                      publishedWithMe: true,
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
          concat(
            of(ConversationsActions.getSelectedConversations()),
            of(
              PublicationActions.rejectPublicationSuccess({ url: payload.url }),
            ),
          ),
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
);
