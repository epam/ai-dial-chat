import {
  Observable,
  catchError,
  concat,
  filter,
  ignoreElements,
  map,
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
import { translate } from '@/src/utils/app/translation';
import { parseConversationApiKey } from '@/src/utils/server/api';

import {
  ApiKeys,
  BackendDataNodeType,
  BackendResourceType,
  UploadStatus,
} from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { PublicationRequest } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { ConversationsActions } from '../conversations/conversations.reducers';
import { UIActions } from '../ui/ui.reducers';
import { PublicationActions } from './publication.reducers';

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
        resources: [
          { sourceUrl: payload.sourceUrl, targetUrl: payload.targetUrl },
        ],
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
          const paths = uniq(
            publication.resources.flatMap((resource) =>
              getParentFolderIdsFromEntityId(
                getFolderIdFromEntityId(resource.reviewUrl),
              ).filter((p) => p !== resource.reviewUrl),
            ),
          );

          actions.push(
            ...publication.resources.map((resource) => {
              const parsedApiKey = parseConversationApiKey(
                splitEntityId(resource.reviewUrl).name,
              );

              return of(
                ConversationsActions.addConversations({
                  conversations: [
                    {
                      id: resource.reviewUrl,
                      folderId: getFolderIdFromEntityId(resource.reviewUrl),
                      model: parsedApiKey.model,
                      name: parsedApiKey.name,
                    },
                  ],
                }),
              );
            }),
          );

          return concat(
            of(
              ConversationsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FolderType.Chat),
                  status: UploadStatus.LOADED,
                  isPublicationFolder: true,
                })),
              }),
            ),
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
    filter(PublicationActions.uploadPublishedItems.match),
    switchMap(({ payload }) =>
      PublicationService.getPublishedWithMeItems('', payload.featureType).pipe(
        switchMap((publications) => {
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
          }

          return concat(
            of(
              PublicationActions.uploadPublishedItemsSuccess({
                publishedItems: publications,
              }),
            ),
            ...actions,
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublishedItemsFail());
        }),
      ),
    ),
  );

const uploadPublishedWithMeItemsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedItemsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedConversationsUploadFailed),
      ),
    ),
  );

const uploadPublishedByMeItemsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedByMeItems.match),
    switchMap(({ payload }) =>
      PublicationService.getPublishedByMeItems(payload.resourceTypes).pipe(
        switchMap((items) => {
          const actions: Observable<AnyAction>[] = [];

          if (payload.resourceTypes.includes(BackendResourceType.PROMPT)) {
            // update prompts
          }

          if (
            payload.resourceTypes.includes(BackendResourceType.CONVERSATION)
          ) {
            const conversations =
              payload.resourceTypes.length === 1
                ? items
                : items.filter(
                    (item) =>
                      item.resourceType === BackendResourceType.CONVERSATION,
                  );

            of(
              ...conversations.map((c) =>
                of(
                  ConversationsActions.updateConversation({
                    id: c.url,
                    values: { isPublished: true },
                  }),
                ),
              ),
            );
          }

          if (payload.resourceTypes.includes(BackendResourceType.FILE)) {
            // update files
          }

          return concat(...actions);
        }),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublishedByMeItemsFail());
        }),
      ),
    ),
  );

const uploadPublishedByMeItemsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedByMeItemsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishingByMeItemsUploadingFailed),
      ),
    ),
  );

const approvePublicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.approvePublication.match),
    switchMap(({ payload }) =>
      PublicationService.approvePublication(payload.url).pipe(
        switchMap(() =>
          concat(
            of(ConversationsActions.getSelectedConversations()),
            of(
              PublicationActions.approvePublicationSuccess({
                url: payload.url,
              }),
            ),
          ),
        ),
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
  uploadPublishedByMeItemsEpic,
  uploadPublishedByMeItemsFailEpic,
  approvePublicationEpic,
  approvePublicationFailEpic,
  rejectPublicationEpic,
  rejectPublicationFailEpic,
);
