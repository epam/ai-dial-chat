import toast from 'react-hot-toast';

import { i18n } from 'next-i18next';

import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  concat,
  filter,
  from,
  ignoreElements,
  iif,
  map,
  merge,
  mergeMap,
  of,
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

import { cleanConversationHistory } from '@/src/utils/app/clean';
import {
  saveConversations,
  saveSelectedConversationIds,
} from '@/src/utils/app/conversation';
import { saveFolders } from '@/src/utils/app/folders';
import {
  CleanDataResponse,
  exportConversation,
  exportConversations,
  importData,
} from '@/src/utils/app/import-export';
import {
  mergeMessages,
  parseStreamMessages,
} from '@/src/utils/app/merge-streams';
import { filterUnfinishedStages } from '@/src/utils/app/stages';

import { ChatBody, Conversation, Message, RateBody } from '@/src/types/chat';
import { AppEpic } from '@/src/types/store';

import { AddonsActions } from '../addons/addons.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { PromptsSelectors } from '../prompts/prompts.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

const createNewConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    map(({ payload }) => ({
      names: payload.names,
      lastConversation: ConversationsSelectors.selectLastConversation(
        state$.value,
      ),
      recentModels: ModelsSelectors.selectRecentModels(state$.value),
    })),
    switchMap(({ names, lastConversation, recentModels }) => {
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

const createNewConversationSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    switchMap(() =>
      merge(of(ModelsActions.getModels()), of(AddonsActions.getAddons())),
    ),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ConversationsActions.createFolder.match(action) ||
        ConversationsActions.deleteFolder.match(action) ||
        ConversationsActions.renameFolder.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action),
    ),
    map(() => ({
      conversationsFolders: ConversationsSelectors.selectFolders(state$.value),
      promptsFolders: PromptsSelectors.selectFolders(state$.value),
    })),
    tap(({ conversationsFolders, promptsFolders }) => {
      saveFolders(conversationsFolders.concat(promptsFolders));
    }),
    ignoreElements(),
  );

const deleteFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteFolder.match),
    map(({ payload }) => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      folderId: payload.folderId,
    })),
    switchMap(({ folderId, conversations }) => {
      return of(
        ConversationsActions.updateConversations({
          conversations: conversations.map((c) => {
            if (c.folderId === folderId) {
              return {
                ...c,
                folderId: null,
              };
            }

            return c;
          }),
        }),
      );
    }),
  );

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.exportConversation.match),
    map(({ payload }) => ({
      conversationId: payload.conversationId,
      conversations: ConversationsSelectors.selectConversations(state$.value),
      folders: ConversationsSelectors.selectFolders(state$.value),
    })),
    tap(({ conversationId, conversations, folders }) => {
      const conversation = conversations.find(
        (conv) => conv.id === conversationId,
      );

      if (!conversation) {
        return;
      }

      const folder = folders.find(
        (folder) => folder.id === conversation.folderId,
      );

      exportConversation(conversation, folder);
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

const importConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.importConversations.match),
    switchMap(({ payload }) => {
      const { history, folders, isError }: CleanDataResponse = importData(
        payload.data,
      );

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
          names: [(i18n as any).t(DEFAULT_CONVERSATION_NAME)],
        }),
      );
    }),
  );

const deleteConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteConversation.match),
    map(() => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      selectedConversationsIds:
        ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    })),
    switchMap(({ conversations, selectedConversationsIds }) => {
      if (conversations.length === 0) {
        return of(
          ConversationsActions.createNewConversations({
            names: [(i18n as any).t(DEFAULT_CONVERSATION_NAME)],
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

const initConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.initConversations.match),
    switchMap(() => {
      return state$.pipe(
        map((state) => ModelsSelectors.selectModels(state)),
        filter((models) => models.length > 0),
        take(1),
        map(() => {
          const conversationHistory = localStorage.getItem(
            'conversationHistory',
          );
          if (conversationHistory) {
            const parsedConversationHistory: Conversation[] =
              JSON.parse(conversationHistory);
            return cleanConversationHistory(parsedConversationHistory);
          }

          return [];
        }),
        map((conversations) => {
          if (!conversations.length) {
            return {
              conversations,
              selectedConversationsIds: [],
            };
          }

          const selectedConversationsIds = (
            JSON.parse(
              localStorage.getItem('selectedConversationIds') || '[]',
            ) as string[]
          ).filter((id) => conversations.some((conv) => conv.id === id));

          return {
            conversations,
            selectedConversationsIds,
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
                  names: [(i18n as any).t(DEFAULT_CONVERSATION_NAME)],
                }),
              ),
            );
          }

          return concat(...actions);
        }),
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
          ConversationsActions.rateMessageFail(
            (i18n as any).t(
              'No conversation exists for rating with provided conversation id',
            ),
          ),
        );
      }
      const message = conversation.messages[payload.messageIndex];

      if (!message || !message.responseId) {
        return of(
          ConversationsActions.rateMessageFail(
            (i18n as any).t('Message cannot be rated'),
          ),
        );
      }

      const rateBody: RateBody = {
        responseId: message.responseId,
        modelId: conversation.model.id,
        id: conversation.id,
        value: payload.rate > 0 ? true : false,
      };

      return fromFetch('/api/rate', {
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
        return of(
          ConversationsActions.rateMessageFail(
            (i18n as any).t('Message cannot be rated'),
          ),
        );
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

const sendMessageEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.sendMessage.match),
    map(({ payload }) => ({
      payload,
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
    })),
    map(({ payload, modelsMap }) => {
      const messageModel: Message['model'] = {
        id: payload.conversation.model.id,
        name: modelsMap[payload.conversation.model.id]?.name,
      };
      const assistantMessage: Message = {
        content: '',
        model: messageModel,
        role: 'assistant',
      };
      const updatedMessages: Message[] = (
        payload.deleteCount > 0
          ? payload.conversation.messages.slice(
              0,
              payload.deleteCount * -1 || undefined,
            )
          : payload.conversation.messages
      ).concat(payload.message, assistantMessage);

      const updatedConversation: Conversation = {
        ...payload.conversation,
        lastActivityDate: Date.now(),
        replay: {
          ...payload.conversation.replay,
          activeReplayIndex: payload.activeReplayIndex,
        },
        messages: updatedMessages,
        name:
          !payload.conversation.replay.isReplay &&
          updatedMessages.length === 2 &&
          payload.conversation.name === DEFAULT_CONVERSATION_NAME
            ? payload.message.content.length > 160
              ? payload.message.content.substring(0, 160) + '...'
              : payload.message.content
            : payload.conversation.name,
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
              modelsMap[payload.conversation.model.id]?.type !== 'application',
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
      const conversationModelType = payload.conversation.model.type;
      let modelAdditionalSettings = {};

      if (conversationModelType === 'model') {
        modelAdditionalSettings = {
          prompt: payload.conversation.prompt,
          temperature: payload.conversation.temperature,
          selectedAddons,
        };
      }
      if (conversationModelType === 'assistant' && assistantModelId) {
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
              message.role !== 'assistant' ||
              index !== payload.conversation.messages.length - 1,
          )
          .map((message) => ({
            content: message.content,
            role: message.role,
            like: void 0,
            ...(message.custom_content?.state && {
              custom_content: { state: message.custom_content?.state },
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
        timeout(20000),
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
                message: (i18n as any).t(errorsMessages.timeoutError),
              }),
            );
          }

          if (error.message === 'ServerError') {
            return of(
              ConversationsActions.streamMessageFail({
                conversation: payload.conversation,
                message: (i18n as any).t(errorsMessages.generalServer),
                response: error.cause,
              }),
            );
          }

          return of(
            ConversationsActions.streamMessageFail({
              conversation: payload.conversation,
              message: (i18n as any).t(errorsMessages.generalClient),
            }),
          );
        }),
      );
    }),
  );

const streamMessageFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.streamMessageFail.match),
    switchMap(({ payload }) => {
      return concat(
        of(
          ConversationsActions.updateMessage({
            conversationId: payload.conversation.id,
            messageIndex: payload.conversation.messages.length - 1,
            values: {
              errorMessage: payload.message,
            },
          }),
        ),
        of(
          ConversationsActions.updateConversation({
            id: payload.conversation.id,
            values: {
              isMessageStreaming: false,
            },
          }),
        ),
        of(
          UIActions.showToast({
            message: payload.message,
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

      return concat(
        of(
          ConversationsActions.sendMessage({
            conversation: conv,
            deleteCount: payload.isRestart
              ? (conversation?.messages.length &&
                  (conversation.messages[conversation.messages.length - 1]
                    .role === 'assistant'
                    ? 2
                    : 1)) ||
                0
              : 0,
            activeReplayIndex: conv.replay.activeReplayIndex,
            message: messagesStack[conv.replay.activeReplayIndex],
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
                },
              },
            }),
          );
        }),
      );
    }),
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
        ConversationsActions.deleteConversation.match(action),
    ),
    map(() =>
      ConversationsSelectors.selectSelectedConversationsIds(state$.value),
    ),
    tap((selectedConversationsIds) => {
      saveSelectedConversationIds(selectedConversationsIds);
    }),
    switchMap((selectedConversationsIds) =>
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
        ConversationsActions.deleteConversation.match(action),
    ),
    map(() => ConversationsSelectors.selectConversations(state$.value)),
    tap((conversations) => {
      saveConversations(conversations);
    }),
    ignoreElements(),
  );

export const ConversationsEpics = combineEpics(
  selectConversationsEpic,
  createNewConversationEpic,
  createNewConversationSuccessEpic,
  saveConversationsEpic,
  saveFoldersEpic,
  deleteFoldersEpic,
  exportConversationEpic,
  exportConversationsEpic,
  importConversationsEpic,
  clearConversationsEpic,
  deleteConversationsEpic,
  initConversationsEpic,
  updateMessageEpic,
  rateMessageEpic,
  rateMessageSuccessEpic,
  sendMessageEpic,
  stopStreamMessageEpic,
  streamMessageEpic,
  streamMessageFailEpic,
  cleanMessagesEpic,
  replayConversationEpic,
  endReplayConversationEpic,
);
