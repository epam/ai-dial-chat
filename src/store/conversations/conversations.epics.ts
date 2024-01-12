import toast from 'react-hot-toast';

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
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import {
  getNewConversationName,
  isSettingsChanged,
} from '@/src/utils/app/conversation';
import { DataService } from '@/src/utils/app/data/data-service';
import {
  findRootFromItems,
  getFolderIdByPath,
  getTemporaryFoldersToPublish,
} from '@/src/utils/app/folders';
import {
  ImportConversationsResponse,
  exportConversation,
  exportConversations,
  importConversations,
} from '@/src/utils/app/import-export';
import {
  mergeMessages,
  parseStreamMessages,
} from '@/src/utils/app/merge-streams';
import { PublishedWithMeFilter } from '@/src/utils/app/search';
import { filterUnfinishedStages } from '@/src/utils/app/stages';
import { translate } from '@/src/utils/app/translation';

import {
  ChatBody,
  Conversation,
  Message,
  MessageSettings,
  Playback,
  RateBody,
  Role,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { AppEpic } from '@/src/types/store';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { AddonsActions } from '../addons/addons.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';

import { v4 as uuidv4 } from 'uuid';

const createNewConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    map(({ payload }) => ({
      names: payload.names,
      lastConversation: ConversationsSelectors.selectLastConversation(
        state$.value,
      ),
    })),
    switchMap(({ names, lastConversation }) => {
      return state$.pipe(
        startWith(state$.value),
        map((state) => ModelsSelectors.selectRecentModels(state)),
        filter((models) => models && models.length > 0),
        take(1),
        map((recentModels) => ({
          lastConversation: ConversationsSelectors.selectLastConversation(
            state$.value,
          ),
          recentModels: recentModels,
        })),
        switchMap(({ recentModels }) => {
          const model = recentModels[0];

          if (!model) {
            return EMPTY;
          }

          return of(
            ConversationsActions.createNewConversationsSuccess({
              names,
              temperature: lastConversation?.temperature,
              model,
            }),
          );
        }),
      );
    }),
  );

const createNewConversationSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    switchMap(() =>
      merge(of(ModelsActions.getModels()), of(AddonsActions.getAddons())),
    ),
  );

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteFolder.match),
    map(({ payload }) => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      childFolders: ConversationsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.folderId,
      ),
      folders: ConversationsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ conversations, childFolders, folders }) => {
      const removedConversationsIds = conversations
        .filter((conv) => conv.folderId && childFolders.has(conv.folderId))
        .map((conv) => conv.id);

      return concat(
        of(
          ConversationsActions.deleteConversations({
            conversationIds: removedConversationsIds,
          }),
        ),
        of(
          ConversationsActions.setFolders({
            folders: folders.filter((folder) => !childFolders.has(folder.id)),
          }),
        ),
      );
    }),
  );

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.exportConversation.match),
    map(({ payload }) =>
      ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ),
    ),
    filter(Boolean),
    tap((conversation) => {
      const parentFolders = ConversationsSelectors.selectParentFolders(
        state$.value,
        conversation.folderId,
      );

      exportConversation(conversation, parentFolders);
    }),
    ignoreElements(),
  );

const exportConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.exportConversations.match),
    map(() => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      folders: ConversationsSelectors.selectFolders(state$.value),
    })),
    tap(({ conversations, folders }) => {
      exportConversations(conversations, folders);
    }),
    ignoreElements(),
  );

const importConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.importConversations.match),
    switchMap(({ payload }) => {
      const currentConversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const currentFolders = ConversationsSelectors.selectFolders(state$.value);
      const { history, folders, isError }: ImportConversationsResponse =
        importConversations(payload.data, {
          currentConversations,
          currentFolders,
        });

      if (isError) {
        toast.error(errorsMessages.unsupportedDataFormat);
        return EMPTY;
      }

      return of(
        ConversationsActions.importConversationsSuccess({
          conversations: history,
          folders,
        }),
      );
    }),
  );

const clearConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.clearConversations.match),
    switchMap(() => {
      return of(
        ConversationsActions.createNewConversations({
          names: [translate(DEFAULT_CONVERSATION_NAME)],
        }),
      );
    }),
  );

const deleteConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteConversations.match),
    map(() => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversationsIds:
        ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    })),
    switchMap(({ conversations, selectedConversationsIds }) => {
      if (conversations.length === 0) {
        return of(
          ConversationsActions.createNewConversations({
            names: [translate(DEFAULT_CONVERSATION_NAME)],
          }),
        );
      } else if (selectedConversationsIds.length === 0) {
        return of(
          ConversationsActions.selectConversations({
            conversationIds: [conversations[conversations.length - 1].id],
          }),
        );
      }

      return EMPTY;
    }),
  );

const initConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.initConversations.match),
    switchMap(() =>
      forkJoin({
        conversations: DataService.getConversations(),
        selectedConversationsIds: DataService.getSelectedConversationsIds(),
      }),
    ),
    map(({ conversations, selectedConversationsIds }) => {
      if (!conversations.length) {
        return {
          conversations,
          selectedConversationsIds: [],
        };
      }

      const existingSelectedConversationsIds = selectedConversationsIds.filter(
        (id) => conversations.some((conv) => conv.id === id),
      );

      return {
        conversations,
        selectedConversationsIds: existingSelectedConversationsIds,
      };
    }),
    switchMap(({ conversations, selectedConversationsIds }) => {
      const actions: Observable<AnyAction>[] = [];
      actions.push(
        of(ConversationsActions.updateConversations({ conversations })),
      );
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

      return concat(...actions);
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
      const message = conversation.messages[payload.messageIndex];

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
      );
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
    })),
    map(({ payload, modelsMap }) => {
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

      const newConversationName = getNewConversationName(
        payload.conversation,
        payload.message,
        updatedMessages,
      );

      const updatedConversation: Conversation = {
        ...payload.conversation,
        lastActivityDate: Date.now(),
        replay: {
          ...payload.conversation.replay,
          activeReplayIndex: payload.activeReplayIndex,
        },
        messages: updatedMessages,
        name: newConversationName,
        isMessageStreaming: true,
      };

      return {
        updatedConversation,
        payload,
        modelsMap,
        assistantMessage,
      };
    }),
    switchMap(
      ({ payload, modelsMap, updatedConversation, assistantMessage }) => {
        return concat(
          of(
            ModelsActions.updateRecentModels({
              modelId: payload.conversation.model.id,
            }),
          ),
          iif(
            () =>
              payload.conversation.selectedAddons.length > 0 &&
              modelsMap[payload.conversation.model.id]?.type !==
                EntityType.Application,
            of(
              AddonsActions.updateRecentAddons({
                addonIds: payload.conversation.selectedAddons,
              }),
            ),
            EMPTY,
          ),
          of(
            ConversationsActions.updateConversation({
              id: payload.conversation.id,
              values: updatedConversation,
            }),
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
        of(ConversationsActions.cleanMessage()),
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
      ),
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

        updatedConversation = {
          ...conv,
          model: model,
          messages,
          replay: {
            ...conv.replay,
            isError: false,
          },
          ...newConversationSettings,
        };
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
            const convReplay = ConversationsSelectors.selectConversation(
              state$.value,
              conv.id,
            )!.replay;

            return concat(
              of(
                ConversationsActions.updateConversation({
                  id: payload.conversationId,
                  values: {
                    replay: {
                      ...convReplay,
                      activeReplayIndex: conv.replay.activeReplayIndex + 1,
                    },
                  },
                }),
              ),
              of(
                ConversationsActions.replayConversation({
                  conversationId: payload.conversationId,
                }),
              ),
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
        ConversationsActions.renameFolder.match(action) ||
        ConversationsActions.moveFolder.match(action) ||
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
      return DataService.setConversationFolders(conversationsFolders);
    }),
    ignoreElements(),
  );

const selectConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.selectConversations.match(action) ||
        ConversationsActions.unselectConversations.match(action) ||
        ConversationsActions.createNewConversationsSuccess.match(action) ||
        ConversationsActions.createNewReplayConversation.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
        ConversationsActions.createNewPlaybackConversation.match(action) ||
        ConversationsActions.deleteConversations.match(action) ||
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
        _: DataService.setSelectedConversationsIds(selectedConversationsIds),
      }),
    ),
    switchMap(({ selectedConversationsIds }) =>
      iif(
        () => selectedConversationsIds.length > 1,
        of(UIActions.setIsCompareMode(true)),
        of(UIActions.setIsCompareMode(false)),
      ),
    ),
  );

const saveConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.createNewConversationsSuccess.match(action) ||
        ConversationsActions.createNewReplayConversation.match(action) ||
        ConversationsActions.updateConversation.match(action) ||
        ConversationsActions.updateConversations.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
        ConversationsActions.deleteConversations.match(action) ||
        ConversationsActions.createNewPlaybackConversation.match(action) ||
        ConversationsActions.addConversations.match(action) ||
        ConversationsActions.unpublishConversation.match(action) ||
        ConversationsActions.duplicateConversation.match(action) ||
        ConversationsActions.duplicateSelectedConversations.match(action),
    ),
    map(() => ConversationsSelectors.selectConversations(state$.value)),
    switchMap((conversations) => {
      return DataService.setConversations(conversations);
    }),
    ignoreElements(),
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
      ),
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

const playbackCalncelEpic: AppEpic = (action$, state$) =>
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

const initFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => ConversationsActions.initFolders.match(action)),
    switchMap(() =>
      DataService.getConversationsFolders().pipe(
        map((folders) => {
          return ConversationsActions.setFolders({
            folders,
          });
        }),
      ),
    ),
  );

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => ConversationsActions.init.match(action)),
    switchMap(() =>
      concat(
        of(ConversationsActions.initFolders()),
        of(ConversationsActions.initConversations()),
      ),
    ),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const shareFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.shareFolder.match),
    map(({ payload }) => ({
      sharedFolderId: payload.id,
      shareUniqueId: payload.shareUniqueId,
      conversations: ConversationsSelectors.selectConversations(state$.value),
      childFolders: ConversationsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.id,
      ),
      folders: ConversationsSelectors.selectFolders(state$.value),
    })),
    switchMap(
      ({
        sharedFolderId,
        shareUniqueId,
        conversations,
        childFolders,
        folders,
      }) => {
        const mapping = new Map();
        childFolders.forEach((folderId) => mapping.set(folderId, uuidv4()));
        const newFolders = folders
          .filter(({ id }) => childFolders.has(id))
          .map(({ folderId, ...folder }) => ({
            ...folder,
            id: mapping.get(folder.id),
            originalId: folder.id,
            folderId:
              folder.id === sharedFolderId ? undefined : mapping.get(folderId), // show shared folder on root level
            ...resetShareEntity,
            sharedWithMe: folder.id === sharedFolderId || folder.sharedWithMe,
            shareUniqueId:
              folder.id === sharedFolderId ? shareUniqueId : undefined,
          }));

        const sharedConversations = conversations
          .filter(
            (conversation) =>
              conversation.folderId && childFolders.has(conversation.folderId),
          )
          .map(({ folderId, ...conversation }) => ({
            ...conversation,
            ...resetShareEntity,
            id: uuidv4(),
            originalId: conversation.id,
            folderId: mapping.get(folderId),
          }));

        return concat(
          of(
            ConversationsActions.addConversations({
              conversations: sharedConversations,
            }),
          ),
          of(
            ConversationsActions.addFolders({
              folders: newFolders,
            }),
          ),
        );
      },
    ),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const shareConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.shareConversation.match),
    map(({ payload }) => ({
      sharedConversationId: payload.id,
      shareUniqueId: payload.shareUniqueId,
      conversations: ConversationsSelectors.selectConversations(state$.value),
    })),
    switchMap(({ sharedConversationId, shareUniqueId, conversations }) => {
      const sharedConversations = conversations
        .filter((conversation) => conversation.id === sharedConversationId)
        .map(({ folderId: _, ...conversation }) => ({
          ...conversation,
          ...resetShareEntity,
          id: uuidv4(),
          originalId: conversation.id,
          folderId: undefined, // show on root level
          sharedWithMe: true,
          shareUniqueId,
        }));

      return concat(
        of(
          ConversationsActions.addConversations({
            conversations: sharedConversations,
          }),
        ),
      );
    }),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const publishFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.publishFolder.match),
    map(({ payload }) => ({
      publishRequest: payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
      childFolders: ConversationsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.id,
      ),
      folders: ConversationsSelectors.selectFolders(state$.value),
      publishedAndTemporaryFolders:
        ConversationsSelectors.selectTemporaryAndFilteredFolders(
          state$.value,
          PublishedWithMeFilter,
        ),
    })),
    switchMap(
      ({
        publishRequest,
        conversations,
        childFolders,
        folders,
        publishedAndTemporaryFolders,
      }) => {
        const mapping = new Map();
        childFolders.forEach((folderId) => mapping.set(folderId, uuidv4()));
        const newFolders = folders
          .filter(({ id }) => childFolders.has(id))
          .map(({ folderId, ...folder }) => ({
            ...folder,
            ...resetShareEntity,
            id: mapping.get(folder.id),
            originalId: folder.id,
            folderId:
              folder.id === publishRequest.id
                ? getFolderIdByPath(
                    publishRequest.path,
                    publishedAndTemporaryFolders,
                  )
                : mapping.get(folderId),
            name:
              folder.id === publishRequest.id
                ? publishRequest.name
                : folder.name,
            publishedWithMe:
              folder.id === publishRequest.id || folder.publishedWithMe,
            shareUniqueId:
              folder.id === publishRequest.id
                ? publishRequest.shareUniqueId
                : folder.shareUniqueId,
            publishVersion:
              folder.id === publishRequest.id
                ? publishRequest.version
                : folder.publishVersion,
          }));

        const rootFolder = findRootFromItems(newFolders);
        const temporaryFolders = getTemporaryFoldersToPublish(
          publishedAndTemporaryFolders,
          rootFolder?.folderId,
          publishRequest.version,
        );

        const sharedConversations = conversations
          .filter(
            (conversation) =>
              conversation.folderId && childFolders.has(conversation.folderId),
          )
          .map(({ folderId, ...conversation }) => ({
            ...conversation,
            ...resetShareEntity,
            id: uuidv4(),
            originalId: conversation.id,
            folderId: mapping.get(folderId),
          }));

        return concat(
          of(
            ConversationsActions.addConversations({
              conversations: sharedConversations,
            }),
          ),
          of(
            ConversationsActions.addFolders({
              folders: [...temporaryFolders, ...newFolders],
            }),
          ),
          of(ConversationsActions.deleteAllTemporaryFolders()),
        );
      },
    ),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const publishConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.publishConversation.match),
    map(({ payload }) => ({
      publishRequest: payload,
      conversations: ConversationsSelectors.selectConversations(state$.value),
      publishedAndTemporaryFolders:
        ConversationsSelectors.selectTemporaryAndFilteredFolders(
          state$.value,
          PublishedWithMeFilter,
        ),
    })),
    switchMap(
      ({ publishRequest, conversations, publishedAndTemporaryFolders }) => {
        const sharedConversations = conversations
          .filter((conversation) => conversation.id === publishRequest.id)
          .map(({ folderId: _, ...conversation }) => ({
            ...conversation,
            ...resetShareEntity,
            id: uuidv4(),
            originalId: conversation.id,
            folderId: getFolderIdByPath(
              publishRequest.path,
              publishedAndTemporaryFolders,
            ),
            publishedWithMe: true,
            name: publishRequest.name,
            shareUniqueId: publishRequest.shareUniqueId,
            publishVersion: publishRequest.version,
          }));

        const rootItem = findRootFromItems(sharedConversations);
        const temporaryFolders = getTemporaryFoldersToPublish(
          publishedAndTemporaryFolders,
          rootItem?.folderId,
          publishRequest.version,
        );

        return concat(
          of(ConversationsActions.addFolders({ folders: temporaryFolders })),
          of(ConversationsActions.deleteAllTemporaryFolders()),
          of(
            ConversationsActions.addConversations({
              conversations: sharedConversations,
            }),
          ),
        );
      },
    ),
  );

export const ConversationsEpics = combineEpics(
  initEpic,
  initConversationsEpic,
  initFoldersEpic,

  selectConversationsEpic,
  createNewConversationEpic,
  createNewConversationSuccessEpic,
  saveConversationsEpic,
  saveFoldersEpic,
  deleteFolderEpic,
  exportConversationEpic,
  exportConversationsEpic,
  importConversationsEpic,
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
  playbackCalncelEpic,

  shareFolderEpic,
  shareConversationEpic,
  publishFolderEpic,
  publishConversationEpic,
);
