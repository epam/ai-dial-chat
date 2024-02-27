import {
  EMPTY,
  catchError,
  concat,
  filter,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  zip,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { ShareService } from '@/src/utils/app/data/share-service';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { translate } from '@/src/utils/app/translation';
import {
  decodeApiUrl,
  encodeApiUrl,
  parseConversationApiKey,
} from '@/src/utils/server/api';

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
                url: encodeApiUrl(payload.resourceId),
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
                url: encodeApiUrl(payload.resourceId) + '/',
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
            url: encodeApiUrl(payload.resourceId),
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
            url: encodeApiUrl(payload.resourceId) + '/',
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
      return UIActions.showErrorToast(translate(errorsMessages.shareFailed));
    }),
  );

const acceptInvitationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.acceptShareInvitation.match),
    switchMap(({ payload }) => {
      return ShareService.shareAccept({
        invitationId: payload.invitationId,
      }).pipe(
        switchMap(() =>
          ShareService.getShareDetails({
            invitationId: payload.invitationId,
          }).pipe(
            switchMap((data) =>
              concat(
                of(ShareActions.acceptShareInvitationSuccess()),
                iif(
                  () => data.resources[0].url.startsWith('conversations'),
                  iif(
                    () => !data.resources[0].url.endsWith('/'),
                    of(
                      ConversationsActions.uploadAndSelectConversationById({
                        ids: [decodeApiUrl(data.resources[0].url)],
                      }),
                    ),
                    of(
                      ConversationsActions.uploadConversationsWithFolders({
                        paths: [decodeApiUrl(data.resources[0].url)],
                        selectFirst: true,
                      }),
                    ),
                  ),
                  concat(
                    iif(
                      () => !data.resources[0].url.endsWith('/'),
                      concat(
                        of(
                          PromptsActions.setSelectedPrompt({
                            promptId: decodeApiUrl(data.resources[0].url),
                          }),
                        ),
                        of(
                          PromptsActions.uploadPrompt({
                            promptId: decodeApiUrl(data.resources[0].url),
                          }),
                        ),
                      ),
                      of(
                        PromptsActions.uploadChildPromptsWithFolders({
                          ids: [decodeApiUrl(data.resources[0].url)],
                          selectFirst: true,
                        }),
                      ),
                    ),
                    of(
                      PromptsActions.setIsEditModalOpen({
                        isOpen: true,
                        isPreview: true,
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        catchError((err) => {
          console.error(err);
          let message = errorsMessages.acceptShareFailed;
          if (err.message === '404') {
            message = errorsMessages.acceptShareNotExists;
          }
          return of(ShareActions.acceptShareInvitationFail({ message }));
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
    map(({ payload }) => {
      history.replaceState({}, '', `${window.location.origin}`);

      return UIActions.showErrorToast(
        translate(payload.message || errorsMessages.acceptShareFailed),
      );
    }),
  );

const triggerGettingSharedListingsConversationsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.initFoldersAndConversationsSuccess.match(action) ||
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
        UIActions.showErrorToast(
          translate(errorsMessages.shareByMeListingFailed),
        ),
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
        const conversations = ConversationsSelectors.selectConversations(
          state$.value,
        );
        const folders = ConversationsSelectors.selectFolders(state$.value);

        if (payload.sharedWith === ShareRelations.others) {
          actions.push(
            ...(payload.resources.folders
              .map((item) => {
                const isShared = folders.find((res) => res.id === item.id);

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
              .filter(Boolean) as AnyAction[]),
          );
          actions.push(
            ...(payload.resources.entities
              .map((conv) => {
                const isSharedConv = conversations.find(
                  (res) => res.id === conv.id,
                );

                if (isSharedConv) {
                  return ConversationsActions.updateConversationSuccess({
                    id: conv.id,
                    conversation: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AnyAction[]),
          );
        } else {
          const [selectedConvId] =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);
          const selectedConv = payload.resources.entities.find(
            (conv) => conv.id === selectedConvId,
          );

          if (selectedConv) {
            actions.push(
              ConversationsActions.selectConversations({
                conversationIds: [selectedConv.id],
              }),
            );
          }

          payload.resources.entities.length &&
            actions.push(
              ConversationsActions.addConversations({
                conversations: payload.resources.entities.map((res) => ({
                  ...(selectedConv && selectedConv.id === res.id
                    ? selectedConv
                    : res),
                  sharedWithMe: true,
                })) as Conversation[],
              }),
            );
          payload.resources.folders.length &&
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
            ...(payload.resources.entities
              .map((item) => {
                const isShared = prompts.find((res) => res.id === item.id);

                if (isShared) {
                  return PromptsActions.updatePromptSuccess({
                    id: item.id,
                    prompt: {
                      isShared: true,
                    },
                  });
                }
                return undefined;
              })
              .filter(Boolean) as AnyAction[]),
          );
          const folders = PromptsSelectors.selectFolders(state$.value);
          payload.resources.folders.length &&
            actions.push(
              ...(payload.resources.folders
                .map((item) => {
                  const isShared = folders.find((res) => res.id === item.id);

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
                .filter(Boolean) as AnyAction[]),
            );
        } else {
          payload.resources.entities.length &&
            actions.push(
              PromptsActions.addPrompts({
                prompts: payload.resources.entities.map((res) => ({
                  ...res,
                  sharedWithMe: true,
                })) as Prompt[],
              }),
            );
          payload.resources.folders.length &&
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

const revokeAccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.revokeAccess.match),
    switchMap(({ payload }) => {
      const resourceUrl =
        payload.nodeType === BackendDataNodeType.FOLDER
          ? encodeApiUrl(payload.resourceId) + '/'
          : encodeApiUrl(payload.resourceId);

      return ShareService.shareRevoke([resourceUrl]).pipe(
        map(() => ShareActions.revokeAccessSuccess(payload)),
        catchError(() => of(ShareActions.revokeAccessFail())),
      );
    }),
  );

const revokeAccessSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.revokeAccessSuccess.match),
    switchMap(({ payload }) => {
      if (
        payload.nodeType === BackendDataNodeType.ITEM &&
        payload.resourceType === BackendResourceType.CONVERSATION
      ) {
        return of(
          ConversationsActions.updateConversationSuccess({
            id: payload.resourceId,
            conversation: {
              isShared: false,
            },
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.FOLDER &&
        payload.resourceType === BackendResourceType.CONVERSATION
      ) {
        return of(
          ConversationsActions.updateFolder({
            folderId: payload.resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.ITEM &&
        payload.resourceType === BackendResourceType.PROMPT
      ) {
        return of(
          PromptsActions.updatePromptSuccess({
            id: payload.resourceId,
            prompt: {
              isShared: false,
            },
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.FOLDER &&
        payload.resourceType === BackendResourceType.PROMPT
      ) {
        return of(
          PromptsActions.updateFolder({
            folderId: payload.resourceId,
            values: {
              isShared: false,
            },
          }),
        );
      }

      console.error(`Entity not updated: ${payload.resourceId}`);
      return EMPTY;
    }),
  );

const revokeAccessFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.revokeAccessFail.match),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(translate(errorsMessages.revokeAccessFailed)),
      );
    }),
  );

const discardSharedWithMeEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.discardSharedWithMe.match),
    switchMap(({ payload }) => {
      const resourceUrl =
        payload.nodeType === BackendDataNodeType.FOLDER
          ? encodeApiUrl(payload.resourceId) + '/'
          : encodeApiUrl(payload.resourceId);

      return ShareService.shareDiscard([resourceUrl]).pipe(
        map(() => ShareActions.discardSharedWithMeSuccess(payload)),
        catchError(() => of(ShareActions.discardSharedWithMeFail())),
      );
    }),
  );

const discardSharedWithMeSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ShareActions.discardSharedWithMeSuccess.match),
    switchMap(({ payload }) => {
      if (
        payload.nodeType === BackendDataNodeType.ITEM &&
        payload.resourceType === BackendResourceType.CONVERSATION
      ) {
        const conversations = ConversationsSelectors.selectConversations(
          state$.value,
        );
        return of(
          ConversationsActions.setConversations({
            conversations: conversations.filter(
              (conv) => conv.id !== payload.resourceId,
            ),
            ignoreCombining: true,
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.FOLDER &&
        payload.resourceType === BackendResourceType.CONVERSATION
      ) {
        const folders = ConversationsSelectors.selectFolders(state$.value);
        return of(
          ConversationsActions.setFolders({
            folders: folders.filter((item) => item.id !== payload.resourceId),
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.ITEM &&
        payload.resourceType === BackendResourceType.PROMPT
      ) {
        const prompts = PromptsSelectors.selectPrompts(state$.value);
        return of(
          PromptsActions.setPrompts({
            prompts: prompts.filter((item) => item.id !== payload.resourceId),
            ignoreCombining: true,
          }),
        );
      }
      if (
        payload.nodeType === BackendDataNodeType.FOLDER &&
        payload.resourceType === BackendResourceType.PROMPT
      ) {
        const folders = PromptsSelectors.selectFolders(state$.value);
        return of(
          PromptsActions.setFolders({
            folders: folders.filter((item) => item.id !== payload.resourceId),
          }),
        );
      }

      console.error(`Entity not updated: ${payload.resourceId}`);
      return EMPTY;
    }),
  );

const discardSharedWithMeFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ShareActions.discardSharedWithMeFail.match),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(
          translate(errorsMessages.discardSharedWithMeFailed),
        ),
      );
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

  revokeAccessEpic,
  revokeAccessSuccessEpic,
  revokeAccessFailEpic,

  discardSharedWithMeEpic,
  discardSharedWithMeSuccessEpic,
  discardSharedWithMeFailEpic,

  getSharedListingEpic,
  getSharedListingFailEpic,
  getSharedListingSuccessEpic,

  triggerGettingSharedListingsConversationsEpic,
  triggerGettingSharedListingsPromptsEpic,
);
