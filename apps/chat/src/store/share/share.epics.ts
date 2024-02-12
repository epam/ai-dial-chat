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

import { ShareService } from '@/src/utils/app/data/share-service';
import { translate } from '@/src/utils/app/translation';

import { Conversation } from '@/src/types/chat';
import { BackendResourceType, FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import {
  ShareByLinkResponseModel,
  ShareRelations,
  ShareRequestType,
} from '@/src/types/share';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { PromptsActions, PromptsSelectors } from '../prompts/prompts.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions } from '../ui/ui.reducers';
import { ShareActions } from './share.reducers';

const shareEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.share.match),
    switchMap(({ payload }) => {
      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources: [
          {
            url: encodeURI(payload.resourceId),
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
        ConversationsActions.uploadConversationsSuccess.match(action) ||
        ShareActions.acceptShareInvitationSuccess.match(action),
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Chat),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            resourceType: BackendResourceType.CONVERSATION,
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            resourceType: BackendResourceType.CONVERSATION,
            sharedWith: ShareRelations.others,
          }),
        ),
      );
    }),
  );

const triggerGettingSharedListingsPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) =>
      // PromptsActions.updatePrompts.match(action) ||
      ShareActions.acceptShareInvitationSuccess.match(action),
    ),
    filter(() =>
      SettingsSelectors.isSharingEnabled(state$.value, FeatureType.Prompt),
    ),
    switchMap(() => {
      return concat(
        of(
          ShareActions.getSharedListing({
            resourceType: BackendResourceType.PROMPT,
            sharedWith: ShareRelations.me,
          }),
        ),
        of(
          ShareActions.getSharedListing({
            resourceType: BackendResourceType.PROMPT,
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
        resourceTypes: [payload.resourceType],
        with: payload.sharedWith,
      }).pipe(
        switchMap((entities) => {
          return of(
            ShareActions.getSharedListingSuccess({
              resourceType: payload.resourceType,
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

// TODO: refactor it to something better
const getSharedListingSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ShareActions.getSharedListingSuccess.match),
    switchMap(({ payload }) => {
      const actions = [];
      if (payload.resourceType === BackendResourceType.CONVERSATION) {
        if (payload.sharedWith === ShareRelations.others) {
          const conversations = ConversationsSelectors.selectConversations(
            state$.value,
          );
          const folders = ConversationsSelectors.selectFolders(state$.value);
          actions.push(
            ...(folders
              .map((item) => {
                const isShared = payload.resources.find(
                  (res) => res.id === item.id,
                );

                if (isShared) {
                  return ConversationsActions.updateFolder({
                    folderId: item.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as any),
          );
          actions.push(
            ...(conversations
              .map((conv) => {
                const isSharedConv = payload.resources.find(
                  (res) => res.id === conv.id,
                );

                if (isSharedConv) {
                  return ConversationsActions.updateConversation({
                    id: conv.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as any),
          );
        } else {
          actions.push(
            ConversationsActions.addConversations({
              conversations: payload.resources
                .filter((res) => !res.id.endsWith('/'))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as Conversation[],
            }),
          );
          actions.push(
            ConversationsActions.addFolders({
              folders: payload.resources
                .filter((res) => res.id.endsWith('/'))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as FolderInterface[],
            }),
          );
        }
      }
      if (payload.resourceType === BackendResourceType.PROMPT) {
        if (payload.sharedWith === ShareRelations.others) {
          const prompts = PromptsSelectors.selectPrompts(state$.value);
          actions.push(
            ...(prompts
              .map((item) => {
                const isShared = payload.resources.find(
                  (res) => res.id === item.id,
                );

                if (isShared) {
                  return PromptsActions.updatePrompt({
                    id: item.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as any),
          );
          const folders = PromptsSelectors.selectFolders(state$.value);
          actions.push(
            ...(folders
              .map((item) => {
                const isShared = payload.resources.find(
                  (res) => res.id === item.id,
                );

                if (isShared) {
                  return PromptsActions.updateFolder({
                    folderId: item.id,
                    values: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as any),
          );
        } else {
          actions.push(
            PromptsActions.addPrompts({
              prompts: payload.resources
                .filter((res) => !res.id.endsWith('/'))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as Prompt[],
            }),
          );
          actions.push(
            PromptsActions.addFolders({
              folders: payload.resources
                .filter((res) => res.id.endsWith('/'))
                .map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as FolderInterface[],
            }),
          );
        }
      }

      return concat(actions);
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
  getSharedListingSuccessEpic,

  triggerGettingSharedListingsConversationsEpic,
  triggerGettingSharedListingsPromptsEpic,
);
