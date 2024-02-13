import {
  EMPTY,
  catchError,
  concat,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
  zip,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { translate } from '@/src/utils/app/translation';
import { parseConversationApiKey } from '@/src/utils/server/api';

import { Conversation, Message } from '@/src/types/chat';
import {
  BackendDataNodeType,
  BackendResourceType,
  FeatureType,
} from '@/src/types/common';
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

const getInternalResourcesUrls = (
  messages: Message[] | undefined,
): string[] => {
  return (messages
    ?.map((message) =>
      message.custom_content?.attachments
        ?.map((attachment) => attachment.url)
        .filter(Boolean),
    )
    .filter(Boolean)
    .flat() || []) as string[];
};

// TODO: refactor it to something better
const shareEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.share.match),
    switchMap(({ payload }) => {
      if (payload.resourceType === BackendResourceType.CONVERSATION) {
        if (payload.nodeType === BackendDataNodeType.ITEM) {
          return of(
            ShareActions.shareConversation({ resourceId: payload.resourceId }),
          );
        } else {
          return of(
            ShareActions.shareConversationFolder({
              resourceId: payload.resourceId,
            }),
          );
        }
      } else {
        if (payload.nodeType === BackendDataNodeType.ITEM) {
          return of(
            ShareActions.sharePrompt({ resourceId: payload.resourceId }),
          );
        } else {
          return of(
            ShareActions.sharePromptFolder({
              resourceId: payload.resourceId,
            }),
          );
        }
      }
    }),
  );

const shareConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.shareConversation.match),
    switchMap(({ payload }) => {
      const { apiKey, bucket, parentPath, name } = splitEntityId(
        payload.resourceId,
      );

      return ConversationService.getConversation({
        ...parseConversationApiKey(payload.resourceId),
        id: payload.resourceId,
        name,
        folderId: constructPath(apiKey, bucket, parentPath),
      }).pipe(
        switchMap((res) => {
          const internalResources = getInternalResourcesUrls(res?.messages);
          return ShareService.share({
            invitationType: ShareRequestType.link,
            resources: [
              {
                url: encodeURI(payload.resourceId),
              },
              ...internalResources.map((res) => ({ url: res })),
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
        catchError((err) => {
          console.error(err);
          return of(ShareActions.shareFail());
        }),
      );
    }),
  );

const shareConversationFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.shareConversationFolder.match),
    switchMap(({ payload }) => {
      return ConversationService.getConversations(payload.resourceId).pipe(
        switchMap((res) =>
          zip(
            res.map((res) =>
              ConversationService.getConversation({
                ...res,
              }),
            ),
          ),
        ),
        map((res) => res.filter(Boolean) as Conversation[]),
        switchMap((conversations: Conversation[]) => {
          const internalResourcesIds = conversations
            .flatMap((res) => getInternalResourcesUrls(res.messages))
            .map((url) => ({ url }));

          return ShareService.share({
            invitationType: ShareRequestType.link,
            resources: [
              {
                url: encodeURI(payload.resourceId + '/'),
              },
              ...internalResourcesIds,
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
        catchError((err) => {
          console.error(err);
          return of(ShareActions.shareFail());
        }),
      );
    }),
  );
const sharePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.sharePrompt.match),
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

const sharePromptFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.sharePromptFolder.match),
    switchMap(({ payload }) => {
      return ShareService.share({
        invitationType: ShareRequestType.link,
        resources: [
          {
            url: encodeURI(payload.resourceId + '/'),
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
    filter(
      (action) =>
        PromptsActions.initPromptsSuccess.match(action) ||
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
                const isShared = payload.resources.folders.find(
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
                const isSharedConv = payload.resources.entities.find(
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
              conversations: payload.resources.entities.map((res) => ({
                ...res,
                sharedWithMe: true,
              })) as Conversation[],
            }),
          );
          actions.push(
            ConversationsActions.addFolders({
              folders: payload.resources.folders.map((res) => ({
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
                const isShared = payload.resources.entities.find(
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
                const isShared = payload.resources.folders.find(
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
              prompts: payload.resources.entities.map((res) => ({
                ...res,
                sharedWithMe: true,
              })) as Prompt[],
            }),
          );
          actions.push(
            PromptsActions.addFolders({
              folders: payload.resources.folders.map((res) => ({
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

  shareConversationEpic,
  sharePromptEpic,
  shareConversationFolderEpic,
  sharePromptFolderEpic,

  acceptInvitationEpic,
  acceptInvitationSuccessEpic,
  acceptInvitationFailEpic,

  getSharedListingEpic,
  getSharedListingFailEpic,
  getSharedListingSuccessEpic,

  triggerGettingSharedListingsConversationsEpic,
  triggerGettingSharedListingsPromptsEpic,
);
