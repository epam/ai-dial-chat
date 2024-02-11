import {
  EMPTY,
  catchError,
  concat,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import { constructPath } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';
import { getApiKeyByResourceType } from '@/src/utils/server/api';

import {
  BackendDataNodeType,
  BackendResourceType,
  FeatureType,
} from '@/src/types/common';
import {
  ShareByLinkResponseModel,
  ShareRelations,
  ShareRequestType,
} from '@/src/types/share';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { ConversationsActions } from '../conversations/conversations.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
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
              encodeURIComponent(getApiKeyByResourceType(payload.resourceType)),
              encodeURIComponent(bucket),
              encodeURIComponent(payload.resourceRelativePath) +
                (payload.nodeType === BackendDataNodeType.FOLDER ? '/' : ''),
            ),
          },
        ],
      }).pipe(
        map((response: ShareByLinkResponseModel) => {
          return ShareActions.shareSuccess({
            invitationId: response.invitationLink.split('/').slice(-1)?.[0],
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

const triggerGettingSharedListingsConversationsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.setConversations.match(action) ||
        ShareActions.acceptShareInvitationSuccess.match(action),
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Chat),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            resourceTypes: [BackendResourceType.CONVERSATION],
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            resourceTypes: [BackendResourceType.CONVERSATION],
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const triggerGettingSharedListingsPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.updatePrompts.match(action) ||
        ShareActions.acceptShareInvitationSuccess.match(action),
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Prompt),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            resourceTypes: [BackendResourceType.PROMPT],
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            resourceTypes: [BackendResourceType.PROMPT],
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const getSharedListingEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.getSharedListing.match),
    mergeMap(({ payload }) => {
      return ShareService.getSharedListing({
        order: 'popular_asc',
        resourceTypes: payload.resourceTypes,
        with: payload.sharedWith,
      }).pipe(
        switchMap((entities) => {
          return of(
            ShareActions.getSharedListingSuccess({
              resourceTypes: payload.resourceTypes,
              sharedWith: payload.sharedWith,
              resources: entities,
            }),
          );
        }),
        catchError((err) => {
          console.error(err);
          return of(ShareActions.getSharedListingFail());
        }),
      );
    }),
  );

const getSharedListingFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.getSharedListingFail.match),
    switchMap(() => {
      return of(
        UIActions.showToast({
          message: translate(errorsMessages.shareByMeListingFailed),
        }),
      );
    }),
  );

export const ShareEpics = combineEpics(
  shareEpic,
  shareFailEpic,

  acceptInvitationEpic,
  acceptInvitationSuccessEpic,
  acceptInvitationFailEpic,

  getSharedListingEpic,
  getSharedListingFailEpic,

  triggerGettingSharedListingsConversationsEpic,
  triggerGettingSharedListingsPromptsEpic,
);
