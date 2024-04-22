import { catchError, filter, ignoreElements, map, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { PublicationService } from '@/src/utils/app/data/publication-service';
import { translate } from '@/src/utils/app/translation';

import { PublicationRequest } from '@/src/types/publication';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { UIActions } from '../ui/ui.reducers';
import { PublicationActions } from './publication.reducers';

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
      };

      return PublicationService.publish(publicationRequestInfo).pipe(
        switchMap((publication) =>
          of(PublicationActions.publishSuccess(publication)),
        ),
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
    switchMap(({ payload }) =>
      PublicationService.publicationList(payload.url).pipe(
        switchMap((publications) =>
          of(PublicationActions.uploadPublicationsSuccess(publications)),
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
        switchMap((publication) =>
          of(PublicationActions.uploadPublicationSuccess(publication)),
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

// TODO: decide do we need refactor to epic which will work with prompts/conversations depends on published data
const uploadPublishedConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedConversations.match),
    switchMap(() =>
      PublicationService.getPublishedConversations('', {
        recursive: true,
      }).pipe(
        switchMap((publications) =>
          of(
            PublicationActions.uploadPublishedConversationsSuccess({
              publishedConversations: publications,
            }),
          ),
        ),
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.uploadPublishedConversationsFail());
        }),
      ),
    ),
  );

const uploadPublishedConversationsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedConversationsFail.match),
    map(() =>
      UIActions.showErrorToast(
        translate(errorsMessages.publishedConversationsUploadFailed),
      ),
    ),
  );

const approvePublicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.approvePublication.match),
    switchMap(({ payload }) =>
      PublicationService.approvePublication(payload.url).pipe(
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.approvePublicationFail());
        }),
      ),
    ),
    ignoreElements(),
  );

const approvePublicationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PublicationActions.uploadPublishedConversationsFail.match),
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
      PublicationService.approvePublication(payload.url).pipe(
        catchError((err) => {
          console.error(err);
          return of(PublicationActions.approvePublicationFail());
        }),
      ),
    ),
    ignoreElements(),
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
  publishEpic,
  publishFailEpic,
  uploadPublicationsEpic,
  uploadPublicationsFailEpic,
  uploadPublicationEpic,
  uploadPublicationFailEpic,
  deletePublicationEpic,
  deletePublicationFailEpic,
  uploadPublishedConversationsEpic,
  uploadPublishedConversationsFailEpic,
  approvePublicationEpic,
  approvePublicationFailEpic,
  rejectPublicationEpic,
  rejectPublicationFailEpic,
);
