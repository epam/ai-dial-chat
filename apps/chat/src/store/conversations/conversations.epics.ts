import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  concat,
  delay,
  filter,
  forkJoin,
  from,
  ignoreElements,
  iif,
  map,
  merge,
  mergeMap,
  of,
  startWith,
  switchMap,
  take,
  takeWhile,
  tap,
  throwError,
  timeout,
  zip,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  combineEntities,
  updateEntitiesFoldersAndIds,
} from '@/src/utils/app/common';
import {
  addGeneratedConversationId,
  compareConversationsByDate,
  getGeneratedConversationId,
  getNewConversationName,
  isChosenConversationValidForCompare,
  isSettingsChanged,
  parseConversationId,
} from '@/src/utils/app/conversation';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import {
  addGeneratedFolderId,
  generateNextName,
  getAllPathsFromId,
  getAllPathsFromPath,
  getFolderFromPath,
  getFoldersFromPaths,
  getNextDefaultName,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import {
  mergeMessages,
  parseStreamMessages,
} from '@/src/utils/app/merge-streams';
import { filterUnfinishedStages } from '@/src/utils/app/stages';
import { translate } from '@/src/utils/app/translation';

import {
  ChatBody,
  Conversation,
  ConversationInfo,
  Message,
  MessageSettings,
  Playback,
  RateBody,
  Role,
} from '@/src/types/chat';
import { EntityType, FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { AppEpic } from '@/src/types/store';

import { resetShareEntity } from '@/src/constants/chat';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';
import { defaultReplay } from '@/src/constants/replay';

import { RootState } from '..';
import { AddonsActions } from '../addons/addons.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => ConversationsActions.init.match(action)),
    switchMap(() =>
      concat(
        of(ConversationsActions.initSelectedConversations()),
        of(ConversationsActions.initFoldersAndConversations()),
      ),
    ),
  );

const initSelectedConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.initSelectedConversations.match),
    switchMap(() => ConversationService.getSelectedConversationsIds()),
    switchMap((selectedIds) => {
      if (!selectedIds.length) {
        return forkJoin({
          selectedConversations: of([]),
          selectedIds: of([]),
        });
      }
      return forkJoin({
        selectedConversations: zip(
          selectedIds.map((id) =>
            ConversationService.getConversation(parseConversationId(id)),
          ),
        ),
        selectedIds: of(selectedIds),
      });
    }),
    map(({ selectedConversations, selectedIds }) => {
      const conversations = selectedConversations
        .filter(Boolean)
        .map((conv) => addGeneratedConversationId(conv!)) as Conversation[];
      if (!selectedIds.length || !conversations.length) {
        return {
          conversations: [],
          selectedConversationsIds: [],
        };
      }

      const existingSelectedConversationsIds = selectedIds.filter((id) =>
        conversations.some((conv) => conv.id === id),
      );

      return {
        conversations,
        selectedConversationsIds: existingSelectedConversationsIds,
      };
    }),
    switchMap(({ conversations, selectedConversationsIds }) => {
      const actions: Observable<AnyAction>[] = [];
      if (conversations.length) {
        actions.push(
          of(
            ConversationsActions.addConversations({
              conversations,
              selectAdded: true,
            }),
          ),
        );
      }
      actions.push(
        of(
          ConversationsActions.selectConversations({
            conversationIds: selectedConversationsIds,
          }),
        ),
      );
      if (!conversations.length || !selectedConversationsIds.length) {
        actions.push(
          of(
            ConversationsActions.createNewConversations({
              names: [translate(DEFAULT_CONVERSATION_NAME)],
            }),
          ),
        );
      }
      actions.push(
        of(ConversationsActions.uploadConversationsWithFoldersRecursive()),
      );

      return concat(...actions);
    }),
  );

const initFoldersAndConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) =>
      ConversationsActions.initFoldersAndConversations.match(action),
    ),
    switchMap(() => ConversationService.getSelectedConversationsIds()),
    switchMap((selectedIds) => {
      const paths = selectedIds.flatMap((id) => getAllPathsFromId(id));
      const uploadPaths = [undefined, ...paths];
      return zip(
        uploadPaths.map((path) =>
          ConversationService.getConversationsAndFolders(path),
        ),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const folders = foldersAndEntities.flatMap((f) => f.folders);
          const conversations = foldersAndEntities.flatMap((f) => f.entities);
          return concat(
            of(
              ConversationsActions.setFolders({
                folders,
              }),
            ),
            of(
              ConversationsActions.setConversations({
                conversations,
              }),
            ),
            of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: paths,
                featureType: FeatureType.Chat,
              }),
            ),
          );
        }),
      );
    }),
  );

const createNewConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    map(({ payload }) => ({
      names: payload.names,
      lastConversation: ConversationsSelectors.selectLastConversation(
        state$.value,
      ),
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ names, lastConversation, conversations }) =>
      forkJoin({
        names: of(names),
        lastConversation: lastConversation
          ? ConversationService.getConversation(lastConversation)
          : of(lastConversation),
        conversations: of(conversations),
      }),
    ),
    switchMap(({ names, lastConversation, conversations }) => {
      return state$.pipe(
        startWith(state$.value),
        map((state) => ModelsSelectors.selectRecentModels(state)),
        filter((models) => models && models.length > 0),
        take(1),
        switchMap((recentModels) => {
          const model = recentModels[0];

          if (!model) {
            return EMPTY;
          }

          const newConversations: Conversation[] = names.map(
            (name: string, index): Conversation => {
              return addGeneratedConversationId({
                name:
                  name !== DEFAULT_CONVERSATION_NAME
                    ? name
                    : getNextDefaultName(
                        DEFAULT_CONVERSATION_NAME,
                        conversations.filter((conv) => !conv.folderId), //only root conversations
                        index,
                      ),
                messages: [],
                model: {
                  id: model.id,
                },
                prompt: DEFAULT_SYSTEM_PROMPT,
                temperature:
                  lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                replay: defaultReplay,
                selectedAddons: [],
                lastActivityDate: Date.now(),
                isMessageStreaming: false,
                status: UploadStatus.LOADED,
              });
            },
          );

          return zip(
            newConversations.map((info) =>
              ConversationService.createConversation(info),
            ),
          ).pipe(
            switchMap(() =>
              of(
                ConversationsActions.addConversations({
                  conversations: newConversations,
                  selectAdded: true,
                }),
              ),
            ),
          );
        }),
      );
    }),
  );

const createNewReplayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewReplayConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationAndPayload: getOrUploadConversation(payload, state$.value),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversationAndPayload, conversations }) => {
      const { conversation } = conversationAndPayload;
      if (!conversation) return EMPTY; // TODO: handle?

      const folderId = ConversationsSelectors.hasExternalParent(
        state$.value,
        conversation.folderId,
      )
        ? undefined
        : conversation.folderId;

      const newConversationName = getNextDefaultName(
        `[Replay] ${conversation.name}`,
        conversations.filter((conv) => conv.folderId === folderId), //only conversations in the same folder
        0,
        true,
      );

      const userMessages = conversation.messages.filter(
        ({ role }) => role === Role.User,
      );
      const newConversation: Conversation = addGeneratedConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        replay: {
          isReplay: true,
          replayUserMessagesStack: userMessages,
          activeReplayIndex: 0,
          replayAsIs: true,
        },
        isReplay: true,
        isPlayback: false,
        playback: {
          isPlayback: false,
          activePlaybackIndex: 0,
          messagesStack: [],
        },
      });

      return of(
        ConversationsActions.createNewConversationSuccess({
          newConversation,
        }),
      );
    }),
  );

const createNewPlaybackConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewPlaybackConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationAndPayload: getOrUploadConversation(payload, state$.value),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversationAndPayload, conversations }) => {
      const { conversation } = conversationAndPayload;
      if (!conversation) return EMPTY; // TODO: handle?

      const folderId = ConversationsSelectors.hasExternalParent(
        state$.value,
        conversation.folderId,
      )
        ? undefined
        : conversation.folderId;

      const newConversationName = getNextDefaultName(
        `[Playback] ${conversation.name}`,
        conversations.filter((conv) => conv.folderId === folderId), //only conversations in the same folder
        0,
        true,
      );

      const newConversation: Conversation = addGeneratedConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        playback: {
          messagesStack: conversation.messages,
          activePlaybackIndex: 0,
          isPlayback: true,
        },
        isReplay: false,
        isPlayback: true,
        replay: {
          isReplay: false,
          replayUserMessagesStack: [],
          activeReplayIndex: 0,
          replayAsIs: false,
        },
      });

      return of(
        ConversationsActions.createNewConversationSuccess({
          newConversation,
        }),
      );
    }),
  );

const duplicateConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.duplicateConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversation: ConversationService.getConversation(payload),
      }),
    ),
    switchMap(({ conversation }) => {
      if (!conversation) return EMPTY;

      const newConversation: Conversation = addGeneratedConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId: undefined,
        name: generateNextName(
          DEFAULT_CONVERSATION_NAME,
          conversation.name,
          state$.value.conversations,
          0,
        ),
        lastActivityDate: Date.now(),
      });

      return of(
        ConversationsActions.createNewConversationSuccess({
          newConversation,
        }),
      );
    }),
  );

const createNewConversationsSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    switchMap(() =>
      merge(of(ModelsActions.getModels()), of(AddonsActions.getAddons())),
    ),
  );

const createNewConversationSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) =>
      ConversationsActions.createNewConversationSuccess.match(action),
    ),
    switchMap(({ payload }) =>
      ConversationService.createConversation(payload.newConversation).pipe(
        switchMap(() => EMPTY),
      ),
    ),
  );

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteFolder.match),
    switchMap(({ payload }) =>
      forkJoin({
        folderId: of(payload.folderId),
        conversations: ConversationService.getConversations(
          payload.folderId,
          true,
        ),
        folders: of(ConversationsSelectors.selectFolders(state$.value)),
      }),
    ),
    switchMap(({ folderId, conversations, folders }) => {
      const childFolders = new Set([
        folderId,
        ...conversations.flatMap((conv) => getAllPathsFromPath(conv.folderId)),
      ]);
      const removedConversationsIds = conversations.map((conv) => conv.id);
      const actions: Observable<AnyAction>[] = [];
      actions.push(
        of(
          ConversationsActions.setFolders({
            folders: folders.filter((folder) => !childFolders.has(folder.id)),
          }),
        ),
      );
      if (removedConversationsIds.length) {
        actions.push(
          of(
            ConversationsActions.deleteConversations({
              conversationIds: removedConversationsIds,
            }),
          ),
        );
      }

      return concat(...actions);
    }),
  );

const updateFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateFolder.match),
    switchMap(({ payload }) => {
      const folder = getFolderFromPath(payload.folderId, FolderType.Chat);
      const newFolder = addGeneratedFolderId({ ...folder, ...payload.values });

      if (payload.folderId === newFolder.id) {
        return EMPTY;
      }

      return ConversationService.getConversations(payload.folderId, true).pipe(
        switchMap((conversations) => {
          const updateFolderId = updateMovedFolderId.bind(
            null,
            payload.folderId,
            newFolder.id,
          );
          const updateEntityId = updateMovedEntityId.bind(
            null,
            payload.folderId,
            newFolder.id,
          );

          const folders = ConversationsSelectors.selectFolders(state$.value);
          const allConversations = ConversationsSelectors.selectConversations(
            state$.value,
          );
          const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
            state$.value,
            FeatureType.Chat,
          );
          const selectedConversationsIds =
            ConversationsSelectors.selectSelectedConversationsIds(state$.value);

          const { updatedFolders, updatedOpenedFoldersIds } =
            updateEntitiesFoldersAndIds(
              conversations,
              folders,
              updateFolderId,
              openedFoldersIds,
            );

          const updatedConversations = combineEntities(
            allConversations.map((conv) =>
              addGeneratedConversationId({
                ...conv,
                folderId: updateFolderId(conv.folderId),
              }),
            ),
            conversations.map((conv) =>
              addGeneratedConversationId({
                ...conv,
                folderId: updateFolderId(conv.folderId),
              }),
            ),
          );

          const updatedSelectedConversationsIds = selectedConversationsIds.map(
            (id) => updateEntityId(id),
          );

          const actions: Observable<AnyAction>[] = [];
          actions.push(
            of(
              ConversationsActions.updateFolderSuccess({
                folders: updatedFolders,
                conversations: updatedConversations,
                selectedConversationsIds: updatedSelectedConversationsIds,
              }),
            ),
            of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: updatedOpenedFoldersIds,
                featureType: FeatureType.Chat,
              }),
            ),
          );
          if (conversations.length) {
            conversations.forEach((conversation) => {
              actions.push(
                of(
                  ConversationsActions.updateConversation({
                    id: conversation.id,
                    values: {
                      folderId: updateFolderId(conversation.folderId),
                    },
                  }),
                ),
              );
            });
          }

          return concat(...actions);
        }),
      );
    }),
  );

const clearConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.clearConversations.match),
    switchMap(() => {
      return concat(
        of(
          ConversationsActions.createNewConversations({
            names: [translate(DEFAULT_CONVERSATION_NAME)],
          }),
        ),
        of(ConversationsActions.clearConversationsSuccess()),
        of(ConversationsActions.deleteFolder({})),
      );
    }),
  );

const deleteConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteConversations.match),
    map(({ payload }) => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversationsIds:
        ConversationsSelectors.selectSelectedConversationsIds(state$.value),
      deleteIds: new Set(payload.conversationIds),
    })),
    switchMap(({ conversations, selectedConversationsIds, deleteIds }) => {
      const otherConversations = conversations.filter(
        (conv) => !deleteIds.has(conv.id),
      );

      const newSelectedConversationsIds = selectedConversationsIds.filter(
        (id) => !deleteIds.has(id),
      );

      const actions: Observable<AnyAction>[] = [
        of(
          ConversationsActions.deleteConversationsSuccess({
            deleteIds,
          }),
        ),
      ];

      if (otherConversations.length === 0) {
        actions.push(
          of(
            ConversationsActions.createNewConversations({
              names: [translate(DEFAULT_CONVERSATION_NAME)],
            }),
          ),
        );
      } else if (newSelectedConversationsIds.length === 0) {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: [
                otherConversations.sort(compareConversationsByDate)[0].id,
              ],
            }),
          ),
        );
      } else if (
        newSelectedConversationsIds.length !== selectedConversationsIds.length
      ) {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: newSelectedConversationsIds,
            }),
          ),
        );
      }

      return concat(
        ...actions,
        zip(
          Array.from(deleteIds).map((id) =>
            ConversationService.deleteConversation(parseConversationId(id)),
          ),
        ).pipe(switchMap(() => EMPTY)),
      );
    }),
  );

const rateMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.rateMessage.match),
    map(({ payload }) => ({
      payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ conversations, payload }) => {
      const conversation = conversations.find(
        (conv) => conv.id === payload.conversationId,
      );
      if (!conversation) {
        return of(
          ConversationsActions.rateMessageFail({
            error: translate(
              'No conversation exists for rating with provided conversation id',
            ),
          }),
        );
      }
      const message = (conversation as Conversation).messages[
        payload.messageIndex
      ];

      if (!message || !message.responseId) {
        return of(
          ConversationsActions.rateMessageFail({
            error: translate('Message cannot be rated'),
          }),
        );
      }

      const rateBody: RateBody = {
        responseId: message.responseId,
        modelId: conversation.model.id,
        id: conversation.id,
        value: payload.rate > 0 ? true : false,
      };

      return fromFetch(`api/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rateBody),
      }).pipe(
        switchMap((resp) => {
          if (!resp.ok) {
            return throwError(() => resp);
          }
          return from(resp.json());
        }),
        map(() => {
          return ConversationsActions.rateMessageSuccess(payload);
        }),
        catchError((e: Response) => {
          return of(
            ConversationsActions.rateMessageFail({
              error: e,
            }),
          );
        }),
      );
    }),
  );

const updateMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateMessage.match),
    map(({ payload }) => ({
      payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ conversations, payload }) => {
      const conversation = conversations.find(
        (conv) => conv.id === payload.conversationId,
      ) as Conversation;
      if (!conversation || !conversation.messages[payload.messageIndex]) {
        return EMPTY;
      }
      const messages = [...conversation.messages];
      messages[payload.messageIndex] = {
        ...messages[payload.messageIndex],
        ...payload.values,
      };
      return of(
        ConversationsActions.updateConversation({
          id: payload.conversationId,
          values: {
            messages: [...messages],
          },
        }),
      );
    }),
  );

const rateMessageSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.rateMessageSuccess.match),
    switchMap(({ payload }) => {
      return of(
        ConversationsActions.updateMessage({
          conversationId: payload.conversationId,
          messageIndex: payload.messageIndex,
          values: {
            like: payload.rate,
          },
        }),
      );
    }),
  );

const sendMessagesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.sendMessages.match),
    switchMap(({ payload }) => {
      return concat(
        of(ConversationsActions.createAbortController()),
        ...payload.conversations.map((conv) => {
          return of(
            ConversationsActions.sendMessage({
              conversation: conv,
              message: payload.message,
              deleteCount: payload.deleteCount,
              activeReplayIndex: payload.activeReplayIndex,
            }),
          );
        }),
      );
    }),
  );

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.sendMessage.match),
    map(({ payload }) => ({
      payload,
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    map(({ payload, modelsMap, conversations, selectedConversations }) => {
      const messageModel: Message[EntityType.Model] = {
        id: payload.conversation.model.id,
      };
      const messageSettings: Message['settings'] = {
        prompt: payload.conversation.prompt,
        temperature: payload.conversation.temperature,
        selectedAddons: payload.conversation.selectedAddons,
        assistantModelId: payload.conversation.assistantModelId,
      };

      const assistantMessage: Message = {
        content: '',
        model: messageModel,
        settings: messageSettings,
        role: Role.Assistant,
      };

      const userMessage: Message = {
        ...payload.message,
        model: messageModel,
        settings: messageSettings,
      };

      const updatedMessages: Message[] = (
        payload.deleteCount > 0
          ? payload.conversation.messages.slice(
              0,
              payload.deleteCount * -1 || undefined,
            )
          : payload.conversation.messages
      ).concat(userMessage, assistantMessage);

      const newConversationName = getNextDefaultName(
        getNewConversationName(
          payload.conversation,
          payload.message,
          updatedMessages,
        ),
        conversations.filter(
          (conv) =>
            conv.folderId === payload.conversation.folderId &&
            conv.id !== payload.conversation.id,
        ),
        Math.max(selectedConversations.indexOf(payload.conversation), 0),
        true,
      );

      const updatedConversation: Conversation = addGeneratedConversationId({
        ...payload.conversation,
        lastActivityDate: Date.now(),
        replay: {
          ...payload.conversation.replay,
          activeReplayIndex: payload.activeReplayIndex,
        },
        messages: updatedMessages,
        name: newConversationName,
        isMessageStreaming: true,
      });

      return {
        oldConversationId: payload.conversation.id,
        updatedConversation,
        modelsMap,
        assistantMessage,
      };
    }),
    switchMap(
      ({
        oldConversationId,
        modelsMap,
        updatedConversation,
        assistantMessage,
      }) => {
        return concat(
          of(
            ConversationsActions.updateConversation({
              id: oldConversationId,
              values: updatedConversation,
            }),
          ),
          of(
            ModelsActions.updateRecentModels({
              modelId: updatedConversation.model.id,
            }),
          ),
          iif(
            () =>
              updatedConversation.selectedAddons.length > 0 &&
              modelsMap[updatedConversation.model.id]?.type !==
                EntityType.Application,
            of(
              AddonsActions.updateRecentAddons({
                addonIds: updatedConversation.selectedAddons,
              }),
            ),
            EMPTY,
          ),
          of(
            ConversationsActions.streamMessage({
              conversation: updatedConversation,
              message: assistantMessage,
            }),
          ),
        );
      },
    ),
  );

const streamMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.streamMessage.match),
    map(({ payload }) => ({
      payload,
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
    })),
    map(({ payload, modelsMap }) => {
      const lastModel = modelsMap[payload.conversation.model.id];
      const selectedAddons = Array.from(
        new Set([
          ...payload.conversation.selectedAddons,
          ...(lastModel?.selectedAddons ?? []),
        ]),
      );
      const assistantModelId = payload.conversation.assistantModelId;
      const conversationModelType = lastModel?.type ?? EntityType.Model;
      let modelAdditionalSettings = {};

      if (conversationModelType === EntityType.Model) {
        modelAdditionalSettings = {
          prompt: payload.conversation.prompt,
          temperature: payload.conversation.temperature,
          selectedAddons,
        };
      }
      if (conversationModelType === EntityType.Assistant && assistantModelId) {
        modelAdditionalSettings = {
          assistantModelId,
          temperature: payload.conversation.temperature,
          selectedAddons,
        };
      }

      const chatBody: ChatBody = {
        modelId: payload.conversation.model.id,
        messages: payload.conversation.messages
          .filter(
            (message, index) =>
              message.role !== Role.Assistant ||
              index !== payload.conversation.messages.length - 1,
          )
          .map((message) => ({
            content: message.content,
            role: message.role,
            like: void 0,
            ...((message.custom_content?.state ||
              message.custom_content?.attachments) && {
              custom_content: {
                state: message.custom_content?.state,
                attachments: message.custom_content?.attachments,
              },
            }),
          })),
        id: payload.conversation.id.toLowerCase(),
        ...modelAdditionalSettings,
      };

      return {
        payload,
        chatBody,
      };
    }),
    mergeMap(({ payload, chatBody }) => {
      const conversationSignal =
        ConversationsSelectors.selectConversationSignal(state$.value);
      const decoder = new TextDecoder();
      let eventData = '';
      let message = payload.message;
      return from(
        fetch('api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatBody),
          signal: conversationSignal.signal,
        }),
      ).pipe(
        switchMap((response) => {
          const body = response.body;

          if (!response.ok) {
            return throwError(
              () => new Error('ServerError', { cause: response }),
            );
          }
          if (!body) {
            return throwError(() => new Error('No body received'));
          }

          const reader = body.getReader();
          const subj = new Subject<ReadableStreamReadResult<Uint8Array>>();
          const observable = subj.asObservable();
          const observer = async () => {
            try {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const val = await reader.read();

                subj.next(val);
                if (val.done) {
                  subj.complete();
                  break;
                }
              }
            } catch (e) {
              subj.error(e);
              subj.complete();
            }
          };
          observer();
          return observable;
        }),
        // TODO: get rid of this https://github.com/epam/ai-dial-chat/issues/115
        timeout(120000),
        mergeMap((resp) =>
          iif(
            () => resp.done,
            concat(
              of(
                ConversationsActions.updateConversation({
                  id: payload.conversation.id,
                  values: {
                    isMessageStreaming: false,
                  },
                }),
              ),
              of(ConversationsActions.streamMessageSuccess()),
            ),
            of(resp).pipe(
              tap((resp) => {
                const decodedValue = decoder.decode(resp.value);
                eventData += decodedValue;
              }),
              filter(() => eventData[eventData.length - 1] === '\0'),
              map((resp) => {
                const chunkValue = parseStreamMessages(eventData);
                return {
                  updatedMessage: mergeMessages(message, chunkValue),
                  isCompleted: resp.done,
                };
              }),
              tap(({ updatedMessage }) => {
                eventData = '';
                message = updatedMessage;
              }),
              map(({ updatedMessage }) =>
                ConversationsActions.updateMessage({
                  conversationId: payload.conversation.id,
                  messageIndex: payload.conversation.messages.length - 1,
                  values: updatedMessage,
                }),
              ),
            ),
          ),
        ),
        catchError((error: Error) => {
          if (error.name === 'AbortError') {
            return of(
              ConversationsActions.updateConversation({
                id: payload.conversation.id,
                values: {
                  isMessageStreaming: false,
                },
              }),
            );
          }

          if (error instanceof TimeoutError) {
            return of(
              ConversationsActions.streamMessageFail({
                conversation: payload.conversation,
                message: translate(errorsMessages.timeoutError),
              }),
            );
          }

          if (error.message === 'ServerError') {
            return of(
              ConversationsActions.streamMessageFail({
                conversation: payload.conversation,
                message:
                  (!!error.cause &&
                    (error.cause as { message?: string }).message) ||
                  translate(errorsMessages.generalServer),
                response:
                  error.cause instanceof Response ? error.cause : undefined,
              }),
            );
          }

          return of(
            ConversationsActions.streamMessageFail({
              conversation: payload.conversation,
              message: translate(errorsMessages.generalClient),
            }),
          );
        }),
      );
    }),
  );

const streamMessageFailEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.streamMessageFail.match),
    switchMap(({ payload }) => {
      return (
        payload.response ? from(payload.response.json()) : of(undefined)
      ).pipe(
        map((response: { message: string } | undefined) => ({
          payload,
          responseJSON: response,
        })),
      );
    }),
    switchMap(({ payload, responseJSON }) => {
      if (payload.response?.status === 401) {
        window.location.assign('api/auth/signin');
        return EMPTY;
      }

      const isReplay =
        ConversationsSelectors.selectIsReplaySelectedConversations(
          state$.value,
        );

      const message = responseJSON?.message || payload.message;

      return concat(
        of(
          ConversationsActions.updateMessage({
            conversationId: payload.conversation.id,
            messageIndex: payload.conversation.messages.length - 1,
            values: {
              errorMessage: message,
            },
          }),
        ),
        isReplay
          ? of(
              ConversationsActions.updateConversation({
                id: payload.conversation.id,
                values: {
                  replay: {
                    ...payload.conversation.replay,
                    isError: true,
                  },
                },
              }),
            )
          : EMPTY,
        of(
          ConversationsActions.updateConversation({
            id: payload.conversation.id,
            values: {
              isMessageStreaming: false,
            },
          }),
        ),
        isReplay ? of(ConversationsActions.stopReplayConversation()) : EMPTY,
        of(
          UIActions.showToast({
            message: message,
            type: 'error',
          }),
        ),
      );
    }),
  );

const stopStreamMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.stopStreamMessage.match),
    tap(() => {
      const conversationSignal =
        ConversationsSelectors.selectConversationSignal(state$.value);

      if (!conversationSignal.signal.aborted) {
        conversationSignal.abort();
      }
    }),
    switchMap(() => {
      const isReplay =
        ConversationsSelectors.selectIsReplaySelectedConversations(
          state$.value,
        );
      return isReplay
        ? of(ConversationsActions.stopReplayConversation())
        : EMPTY;
    }),
  );

const cleanMessagesEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.stopStreamMessage.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: { messages: filterUnfinishedStages(conv.messages) },
            }),
          );
        }),
      );
    }),
  );

const deleteMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteMessage.match),
    map(({ payload }) => ({
      payload,
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ payload, selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          const { messages } = conv;
          let newMessages = [];

          if (
            payload.index < messages.length - 1 &&
            messages[payload.index + 1].role === Role.Assistant
          ) {
            newMessages = messages.filter(
              (message, index) =>
                index !== payload.index && index !== payload.index + 1,
            );
          } else {
            newMessages = messages.filter(
              (message, index) => index !== payload.index,
            );
          }

          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: newMessages,
              },
            }),
          );
        }),
      );
    }),
  );

const replayConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.replayConversations.match),
    switchMap(({ payload }) => {
      return concat(
        of(ConversationsActions.createAbortController()),
        ...payload.conversationsIds.map((id) => {
          return of(
            ConversationsActions.replayConversation({
              ...payload,
              conversationId: id,
              activeReplayIndex: 0,
            }),
          );
        }),
      );
    }),
  );

const replayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.replayConversation.match),
    map(({ payload }) => ({
      payload,
      conversation: ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ) as Conversation,
    })),
    filter(({ conversation }) => !!conversation),
    switchMap(({ payload, conversation }) => {
      const conv = conversation as Conversation;
      const messagesStack = conv.replay.replayUserMessagesStack;

      if (
        !messagesStack ||
        conv.replay.activeReplayIndex === messagesStack.length
      ) {
        return of(
          ConversationsActions.endReplayConversation({
            conversationId: payload.conversationId,
          }),
        );
      }
      const activeMessage = messagesStack[conv.replay.activeReplayIndex];
      let updatedConversation: Conversation = conv;

      if (
        conv.replay.replayAsIs &&
        activeMessage.model &&
        activeMessage.model.id
      ) {
        const { prompt, temperature, selectedAddons, assistantModelId } =
          activeMessage.settings ? activeMessage.settings : conv;

        const newConversationSettings: MessageSettings = {
          prompt,
          temperature,
          selectedAddons,
          assistantModelId,
        };

        const model =
          ModelsSelectors.selectModel(state$.value, activeMessage.model.id) ??
          conv.model;

        const messages =
          conv.model.id !== model.id ||
          isSettingsChanged(conv, newConversationSettings)
            ? clearStateForMessages(conv.messages)
            : conv.messages;

        updatedConversation = addGeneratedConversationId({
          ...conv,
          model: model,
          messages,
          replay: {
            ...conv.replay,
            isError: false,
          },
          ...newConversationSettings,
        });
      }

      return concat(
        of(
          ConversationsActions.sendMessage({
            conversation: updatedConversation,
            deleteCount: payload.isRestart
              ? (conversation?.messages.length &&
                  (conversation.messages[conversation.messages.length - 1]
                    .role === Role.Assistant
                    ? 2
                    : 1)) ||
                0
              : 0,
            activeReplayIndex: updatedConversation.replay.activeReplayIndex,
            message: activeMessage,
          }),
        ),
        action$.pipe(
          takeWhile(() => {
            return !ConversationsSelectors.selectIsReplayPaused(state$.value);
          }),
          filter(ConversationsActions.streamMessageSuccess.match),
          filter(() => {
            return !ConversationsSelectors.selectIsConversationsStreaming(
              state$.value,
            );
          }),
          switchMap(() => {
            const convReplay = (
              ConversationsSelectors.selectConversation(
                state$.value,
                conv.id,
              ) as Conversation
            ).replay;

            return of(
              ConversationsActions.replayConversation({
                conversationId: updatedConversation.id,
                activeReplayIndex: convReplay.activeReplayIndex + 1,
              }),
            );
          }),
        ),
        action$.pipe(
          takeWhile(() => {
            return !ConversationsSelectors.selectIsReplayPaused(state$.value);
          }),
          filter(ConversationsActions.streamMessageFail.match),
          switchMap(() => {
            return of(ConversationsActions.stopReplayConversation());
          }),
        ),
      );
    }),
  );

const endReplayConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.endReplayConversation.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                isReplay: false,
                replay: {
                  ...conv.replay,
                  isReplay: false,
                  replayAsIs: false,
                },
              },
            }),
          );
        }),
      );
    }),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.createFolder.match(action) ||
        ConversationsActions.deleteFolder.match(action) ||
        ConversationsActions.updateFolderSuccess.match(action) ||
        ConversationsActions.clearConversations.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
        ConversationsActions.addFolders.match(action) ||
        ConversationsActions.unpublishFolder.match(action) ||
        ConversationsActions.setFolders.match(action),
    ),
    map(() => ({
      conversationsFolders: ConversationsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ conversationsFolders }) => {
      return ConversationService.setConversationFolders(conversationsFolders);
    }),
    ignoreElements(),
  );

const selectConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.updateFolderSuccess.match(action) ||
        ConversationsActions.selectConversations.match(action) ||
        ConversationsActions.unselectConversations.match(action) ||
        ConversationsActions.updateConversationSuccess.match(action) ||
        ConversationsActions.createNewConversationSuccess.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
        ConversationsActions.deleteConversationsSuccess.match(action) ||
        ConversationsActions.addConversations.match(action) ||
        ConversationsActions.duplicateConversation.match(action) ||
        ConversationsActions.duplicateSelectedConversations.match(action),
    ),
    map(() =>
      ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    ),
    switchMap((selectedConversationsIds) =>
      forkJoin({
        selectedConversationsIds: of(selectedConversationsIds),
        _: ConversationService.setSelectedConversationsIds(
          selectedConversationsIds,
        ),
      }),
    ),
    switchMap(({ selectedConversationsIds }) =>
      concat(
        of(UIActions.setIsCompareMode(selectedConversationsIds.length > 1)),
      ),
    ),
  );

const uploadSelectedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.selectConversations.match),
    map(() =>
      ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    ),
    switchMap((selectedConversationsIds) =>
      concat(
        of(
          ConversationsActions.uploadConversationsByIds({
            conversationIds: selectedConversationsIds,
            showLoader: true,
          }),
        ),
      ),
    ),
  );

const compareConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.selectForCompare.match),
    switchMap(({ payload }) => getOrUploadConversation(payload, state$.value)),
    switchMap(({ conversation: chosenConversation }) => {
      const selectedConversation =
        ConversationsSelectors.selectSelectedConversations(state$.value)[0];
      const isInvalid =
        !chosenConversation ||
        !isChosenConversationValidForCompare(
          selectedConversation,
          chosenConversation as Conversation,
        );
      const actions: Observable<AnyAction>[] = [];
      if (isInvalid) {
        actions.push(
          of(
            UIActions.showToast({
              message: translate(
                'Incorrect conversation was chosen for comparison. Please choose another one.\r\nNote: only conversations with the same count of user messages can be compared',
              ),
              type: 'error',
            }),
          ),
        );
      } else {
        actions.push(
          of(
            ConversationsActions.selectConversations({
              conversationIds: [selectedConversation.id, chosenConversation.id],
            }),
          ),
        );
      }
      actions.push(
        of(
          ConversationsActions.selectForCompareCompleted(
            chosenConversation as Conversation,
          ),
        ),
      );

      return concat(...actions);
    }),
  );

const playbackNextMessageStartEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackNextMessageStart.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activeIndex = conv.playback.activePlaybackIndex;
          const userMessage: Message = conv.playback.messagesStack[activeIndex];

          const originalAssistantMessage: Message =
            conv.playback.messagesStack[activeIndex + 1];

          const assistantMessage: Message = {
            ...originalAssistantMessage,
            content: '',
            role: Role.Assistant,
          };
          const updatedMessages = conv.messages.concat(
            userMessage,
            assistantMessage,
          );
          const { prompt, temperature, selectedAddons, assistantModelId } =
            assistantMessage.settings ? assistantMessage.settings : conv;

          return concat(
            of(
              ConversationsActions.updateConversation({
                id: conv.id,
                values: {
                  messages: updatedMessages,
                  isMessageStreaming: true,
                  model: { ...conv.model, ...assistantMessage.model },
                  prompt,
                  temperature: temperature,
                  selectedAddons: selectedAddons,
                  assistantModelId: assistantModelId,
                  playback: {
                    ...conv.playback,
                    activePlaybackIndex: activeIndex + 1,
                  },
                },
              }),
            ),
            of(
              ConversationsActions.playbackNextMessageEnd({
                conversationId: conv.id,
              }),
            ).pipe(
              delay(1000),
              takeWhile(
                () =>
                  !ConversationsSelectors.selectIsPlaybackPaused(state$.value),
              ),
            ),
          );
        }),
      );
    }),
  );

const playbackNextMessageEndEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackNextMessageEnd.match),
    map(({ payload }) => ({
      selectedConversation: ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ) as Conversation,
    })),
    switchMap(({ selectedConversation }) => {
      if (!selectedConversation) {
        return EMPTY;
      }
      if (!selectedConversation.playback) {
        return EMPTY;
      }
      const activeIndex = selectedConversation.playback.activePlaybackIndex;

      const assistantMessage: Message =
        selectedConversation.playback.messagesStack[activeIndex];

      const messagesDeletedLastMessage = selectedConversation.messages.slice(
        0,
        activeIndex,
      );

      const updatedMessagesWithAssistant =
        messagesDeletedLastMessage.concat(assistantMessage);

      return of(
        ConversationsActions.updateConversation({
          id: selectedConversation.id,
          values: {
            messages: updatedMessagesWithAssistant,
            isMessageStreaming: false,
            playback: {
              ...(selectedConversation.playback as Playback),
              activePlaybackIndex: activeIndex + 1,
            },
          },
        }),
      );
    }),
  );

const playbackPrevMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackPrevMessage.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
      isMessageStreaming: ConversationsSelectors.selectIsConversationsStreaming(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations, isMessageStreaming }) => {
      return concat(
        isMessageStreaming ? of(ConversationsActions.playbackStop()) : EMPTY,
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activePlaybackIndex = conv.playback.activePlaybackIndex;
          const activeIndex = isMessageStreaming
            ? activePlaybackIndex - 1
            : activePlaybackIndex - 2;
          const updatedMessages = conv.messages.slice(0, activeIndex);

          const activeAssistantIndex =
            activePlaybackIndex > 2 ? activePlaybackIndex - 3 : 0;
          const assistantMessage = conv.messages[activeAssistantIndex];
          const model = assistantMessage.model
            ? { ...conv.model, ...assistantMessage.model }
            : conv.model;

          const { prompt, temperature, selectedAddons, assistantModelId } =
            assistantMessage.settings ? assistantMessage.settings : conv;
          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: updatedMessages,
                isMessageStreaming: false,
                model,
                prompt,
                temperature: temperature,
                selectedAddons: selectedAddons,
                assistantModelId: assistantModelId,
                playback: {
                  ...conv.playback,
                  activePlaybackIndex: activeIndex,
                },
              },
            }),
          );
        }),
      );
    }),
  );

const playbackCancelEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.playbackCancel.match),
    map(() => ({
      selectedConversations: ConversationsSelectors.selectSelectedConversations(
        state$.value,
      ),
      isMessageStreaming: ConversationsSelectors.selectIsConversationsStreaming(
        state$.value,
      ),
    })),
    switchMap(({ selectedConversations, isMessageStreaming }) => {
      return concat(
        ...selectedConversations.map((conv) => {
          if (!conv.playback) {
            return EMPTY;
          }
          const activePlaybackIndex = conv.playback.activePlaybackIndex;

          const updatedMessages = isMessageStreaming
            ? conv.messages.slice(0, activePlaybackIndex)
            : conv.messages;

          return of(
            ConversationsActions.updateConversation({
              id: conv.id,
              values: {
                messages: updatedMessages,
                isMessageStreaming: false,
                isPlayback: false,
                playback: {
                  ...(conv.playback as Playback),
                  messagesStack: [],
                  activePlaybackIndex: 0,
                  isPlayback: false,
                },
              },
            }),
          );
        }),
      );
    }),
  );

const uploadConversationsByIdsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsByIds.match),
    switchMap(({ payload }) => {
      const conversationInfos = payload.conversationIds.map((id: string) =>
        parseConversationId(id),
      ) as ConversationInfo[];
      return forkJoin({
        uploadedConversations: zip(
          conversationInfos.map((info) =>
            ConversationService.getConversation(info),
          ),
        ),
        setIds: of(new Set(payload.conversationIds as string[])),
        showLoader: of(payload.showLoader),
      });
    }),
    switchMap(({ uploadedConversations, setIds, showLoader }) => {
      const actions: Observable<AnyAction>[] = [];
      actions.push(
        of(
          ConversationsActions.uploadConversationsByIdsSuccess({
            setIds,
            conversations: uploadedConversations.filter(
              Boolean,
            ) as Conversation[],
            showLoader,
          }),
        ),
      );
      const conversationsWithIncorrectKeys = uploadedConversations.filter(
        (conv) => conv && conv.id !== getGeneratedConversationId(conv),
      ) as Conversation[];
      if (conversationsWithIncorrectKeys.length) {
        conversationsWithIncorrectKeys.forEach((conv) =>
          actions.push(
            of(
              ConversationsActions.updateConversation({
                id: conv.id,
                values: {
                  ...conv,
                  status: UploadStatus.LOADED,
                },
              }),
            ),
          ),
        );
      }
      return concat(...actions);
    }),
  );

const saveConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.saveConversation.match(action) &&
        !action.payload.isMessageStreaming, // shouldn't save during streaming
    ),
    switchMap(({ payload: newConversation }) => {
      return ConversationService.updateConversation(newConversation).pipe(
        switchMap(() => EMPTY),
      );
    }),
  );

const recreateConversationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.recreateConversation.match),
    mergeMap(({ payload }) => {
      return concat(
        ConversationService.createConversation(payload.new).pipe(
          switchMap(() => EMPTY),
        ),
        ConversationService.deleteConversation(
          parseConversationId(payload.old.id),
        ).pipe(switchMap(() => EMPTY)),
      );
    }),
  );

const getOrUploadConversation = (
  payload: { id: string },
  state: RootState,
): Observable<{
  conversation: Conversation | null;
  payload: { id: string };
}> => {
  const conversation = ConversationsSelectors.selectConversation(
    state,
    payload.id,
  ) as Conversation;

  if (conversation?.status !== UploadStatus.LOADED) {
    return forkJoin({
      conversation: ConversationService.getConversation(
        parseConversationId(payload.id),
      ),
      payload: of(payload),
    });
  } else {
    return forkJoin({
      conversation: of(conversation),
      payload: of(payload),
    });
  }
};

const updateConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.updateConversation.match),
    mergeMap(({ payload }) => {
      return getOrUploadConversation(payload, state$.value);
    }),
    mergeMap(({ payload, conversation }) => {
      const { id, values } = payload as {
        id: string;
        values: Partial<Conversation>;
      };
      if (!conversation) {
        return EMPTY; // TODO: handle?
      }
      const newConversation: Conversation = addGeneratedConversationId({
        ...(conversation as Conversation),
        ...values,
        lastActivityDate: Date.now(),
      });

      return concat(
        of(
          ConversationsActions.updateConversationSuccess({
            id,
            conversation: {
              ...values,
              id: newConversation.id,
            },
          }),
        ),
        iif(
          () => !!conversation && conversation.id !== newConversation.id,
          of(
            ConversationsActions.recreateConversation({
              new: newConversation,
              old: conversation,
            }),
          ),
          of(ConversationsActions.saveConversation(newConversation)),
        ),
      );
    }),
  );

const uploadConversationsWithFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsWithFolders.match),
    switchMap(({ payload }) =>
      zip(
        payload.paths.map((path) =>
          ConversationService.getConversationsAndFolders(path),
        ),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const folders = foldersAndEntities.flatMap((f) => f.folders);
          const conversations = foldersAndEntities.flatMap((f) => f.entities);
          return concat(
            of(
              ConversationsActions.uploadFoldersSuccess({
                paths: new Set(payload.paths),
                folders: folders,
              }),
            ),
            of(
              ConversationsActions.uploadConversationsSuccess({
                paths: new Set(payload.paths),
                conversations: conversations,
              }),
            ),
          );
        }),
        catchError(() =>
          concat(
            of(
              ConversationsActions.uploadFoldersFail({
                paths: new Set(payload.paths),
              }),
            ),
            of(ConversationsActions.uploadConversationsFail()),
          ),
        ),
      ),
    ),
  );

// const uploadFoldersEpic: AppEpic = (action$) =>
//   action$.pipe(
//     filter(ConversationsActions.uploadFolders.match),
//     switchMap(({ payload }) =>
//       zip(
//         payload.paths.map((path) =>
//           ConversationService.getConversationsFolders(path),
//         ),
//       ).pipe(
//         switchMap((folders) =>
//           concat(
//             of(
//               ConversationsActions.uploadFoldersSuccess({
//                 paths: new Set(payload.paths),
//                 folders: folders.flat(),
//               }),
//             ),
//           ),
//         ),
//         catchError(() =>
//           of(
//             ConversationsActions.uploadFoldersFail({
//               paths: new Set(payload.paths),
//             }),
//           ),
//         ),
//       ),
//     ),
//   );

// const uploadConversationsEpic: AppEpic = (action$) =>
//   action$.pipe(
//     filter(ConversationsActions.uploadConversations.match),
//     switchMap(({ payload }) =>
//       zip(
//         payload.paths.map((path: string | undefined) =>
//           ConversationService.getConversations(path),
//         ),
//       ).pipe(
//         map((conversations) =>
//           ConversationsActions.uploadConversationsSuccess({
//             paths: new Set(payload.paths),
//             conversations: conversations.flat(),
//           }),
//         ),
//         catchError(() => of(ConversationsActions.uploadConversationsFail())),
//       ),
//     ),
//   );

const uploadConversationsWithFoldersRecursiveEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.uploadConversationsWithFoldersRecursive.match),
    switchMap(() =>
      ConversationService.getConversations(undefined, true).pipe(
        switchMap((conversations) => {
          const conv = conversations.flat();
          const folderIds = Array.from(new Set(conv.map((c) => c.folderId)));
          const paths = Array.from(
            new Set(folderIds.flatMap((id) => getAllPathsFromPath(id))),
          );
          return concat(
            of(
              ConversationsActions.uploadConversationsSuccess({
                paths: new Set(),
                conversations: conv,
              }),
            ),
            of(
              ConversationsActions.uploadFoldersSuccess({
                paths: new Set(),
                folders: getFoldersFromPaths(paths, FolderType.Chat),
                allLoaded: true,
              }),
            ),
          );
        }),
        catchError(() => of(ConversationsActions.uploadConversationsFail())),
      ),
    ),
  );

const toggleFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.toggleFolder.match),
    switchMap(({ payload }) => {
      const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
        state$.value,
        FeatureType.Chat,
      );
      const isOpened = openedFoldersIds.includes(payload.id);
      const action = isOpened ? UIActions.closeFolder : UIActions.openFolder;
      return of(
        action({
          id: payload.id,
          featureType: FeatureType.Chat,
        }),
      );
    }),
  );

const openFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        UIActions.openFolder.match(action) &&
        action.payload.featureType === FeatureType.Chat,
    ),
    switchMap(({ payload }) => {
      const folder = ConversationsSelectors.selectFolders(state$.value).find(
        (f) => f.id === payload.id,
      );
      if (folder?.status === UploadStatus.LOADED) {
        return EMPTY;
      }
      return concat(
        of(
          ConversationsActions.uploadConversationsWithFolders({
            paths: [payload.id],
          }),
        ),
      );
    }),
  );

export const ConversationsEpics = combineEpics(
  // init
  initEpic,
  initSelectedConversationsEpic,
  initFoldersAndConversationsEpic,
  // update
  updateConversationEpic,
  saveConversationEpic,
  recreateConversationEpic,
  createNewConversationsEpic,
  // select
  selectConversationsEpic,
  uploadSelectedConversationsEpic,

  createNewConversationSuccessEpic,
  createNewConversationsSuccessEpic,
  saveFoldersEpic,
  deleteFolderEpic,
  updateFolderEpic,
  clearConversationsEpic,
  deleteConversationsEpic,
  updateMessageEpic,
  rateMessageEpic,
  rateMessageSuccessEpic,
  sendMessageEpic,
  sendMessagesEpic,
  stopStreamMessageEpic,
  streamMessageEpic,
  streamMessageFailEpic,
  cleanMessagesEpic,
  replayConversationEpic,
  replayConversationsEpic,
  endReplayConversationEpic,
  deleteMessageEpic,
  playbackNextMessageStartEpic,
  playbackNextMessageEndEpic,
  playbackPrevMessageEpic,
  playbackCancelEpic,

  createNewReplayConversationEpic,
  createNewPlaybackConversationEpic,
  duplicateConversationEpic,
  uploadConversationsByIdsEpic,

  uploadConversationsWithFoldersEpic,
  // uploadFoldersEpic,
  uploadConversationsWithFoldersRecursiveEpic,
  toggleFolderEpic,
  openFolderEpic,
  compareConversationsEpic,
);
