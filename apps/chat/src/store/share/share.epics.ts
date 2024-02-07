import { EMPTY, catchError, filter, map, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import { constructPath } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';
import { getApiKeyByResourceType } from '@/src/utils/server/api';

import { ShareByLinkResponseModel, ShareRequestType } from '@/src/types/share';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { UIActions } from '../ui/ui.reducers';
import { ShareActions } from './share.reducers';

const shareEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.share.match),
    switchMap(({ payload }) => {
      const bucket = BucketService.getBucket();
      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources: [
          {
            url: constructPath(
              getApiKeyByResourceType(payload.resourceType),
              bucket,
              payload.resourceRelativePath,
            ),
          },
        ],
      }).pipe(
        map((response: ShareByLinkResponseModel) => {
          return ShareActions.shareSuccess({
            invitationId: response.url.split('/').slice(-1)?.[0],
          });
        }),
        catchError((err) => {
          console.error(err);
          return of(ShareActions.shareFail());
        }),
      );
    }),
  );

const shareFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.shareFail.match),
    map(() => {
      return UIActions.showToast({
        message: translate(errorsMessages.shareFailed),
      });
    }),
  );

const acceptInvitationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.acceptShareInvitation.match),
    switchMap(({ payload }) => {
      return ShareService.shareAccept({
        invitationId: payload.invitationId,
      }).pipe(
        map(() => {
          return ShareActions.acceptShareInvitationSuccess();
        }),
        catchError((err) => {
          console.error(err);
          return of(ShareActions.acceptShareInvitationFail());
        }),
      );
    }),
  );

const acceptInvitationSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.acceptShareInvitationSuccess.match),
    switchMap(() => {
      history.replaceState({}, '', `${window.location.origin}`);

      return EMPTY;
    }),
  );

const acceptInvitationFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.acceptShareInvitationFail.match),
    map(() => {
      history.replaceState({}, '', `${window.location.origin}`);

      return UIActions.showToast({
        message: translate(errorsMessages.acceptShareFailed),
      });
    }),
  );

export const ShareEpics = combineEpics(
  shareEpic,
  shareFailEpic,
  acceptInvitationEpic,
  acceptInvitationSuccessEpic,
  acceptInvitationFailEpic,
);
