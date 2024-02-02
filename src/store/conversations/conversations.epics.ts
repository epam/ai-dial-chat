import toast from 'react-hot-toast';

import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  concat,
  debounceTime,
  delay,
  filter,
  finalize,
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
  filterNotMigratedEntities,
  filterOnlyMyEntities,
} from '@/src/utils/app/common';
import {
  addGeneratedConversationId,
  getNewConversationName,
  isSettingsChanged,
} from '@/src/utils/app/conversation';
import { DataService } from '@/src/utils/app/data/data-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import {
  generateNextName,
  getNextDefaultName,
  getPathToFolderById,
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
import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';
import { defaultReplay } from '@/src/constants/replay';

import { AddonsActions } from '../addons/addons.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';
import { hasExternalParent } from './conversations.selectors';

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
          ? DataService.getConversation(lastConversation)
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
            (name, index): Conversation => {
              return addGeneratedConversationId({
                name:
                  name !== DEFAULT_CONVERSATION_NAME
                    ? name
                    : getNextDefaultName(
                        DEFAULT_CONVERSATION_NAME,
                        conversations,
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
              });
            },
          );

          return zip(
            newConversations.map((info) =>
              DataService.createConversation(info),
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
        conversation: DataService.getConversation(payload),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversation, conversations }) => {
      if (!conversation) return EMPTY;

      const newConversationName = getNextDefaultName(
        `[Replay] ${conversation.name}`,
        conversations,
        0,
        true,
      );

      const userMessages = conversation.messages.filter(
        ({ role }) => role === Role.User,
      );
      const newConversation: Conversation = addGeneratedConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId: hasExternalParent(
          { conversations: state$.value },
          conversation.folderId,
        )
          ? undefined
          : conversation.folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        replay: {
          isReplay: true,
          replayUserMessagesStack: userMessages,
          activeReplayIndex: 0,
          replayAsIs: true,
        },

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
        conversation: DataService.getConversation(payload),
        conversations: of(
          ConversationsSelectors.selectConversations(state$.value),
        ),
      }),
    ),
    switchMap(({ conversation, conversations }) => {
      if (!conversation) return EMPTY;

      const newConversationName = getNextDefaultName(
        `[Playback] ${conversation.name}`,
        conversations,
        0,
        true,
      );

      const newConversation: Conversation = addGeneratedConversationId({
        ...conversation,
        ...resetShareEntity,
        folderId: hasExternalParent(
          { conversations: state$.value },
          conversation.folderId,
        )
          ? undefined
          : conversation.folderId,
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        playback: {
          messagesStack: conversation.messages,
          activePlaybackIndex: 0,
          isPlayback: true,
        },

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
        conversation: DataService.getConversation(payload),
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
      DataService.createConversation(payload.newConversation).pipe(
        switchMap(() => EMPTY),
      ),
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
      //TODO: upload all conversations for export - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
      exportConversation(conversation as Conversation, parentFolders);
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
      //TODO: upload all conversations for export - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
      exportConversations(conversations as Conversation[], folders);
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
          //TODO: save in API - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
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

const clearConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.clearConversations.match),
    switchMap(() => {
      const conversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      return concat(
        of(
          ConversationsActions.createNewConversations({
            names: [translate(DEFAULT_CONVERSATION_NAME)],
          }),
        ),
        of(ConversationsActions.clearConversationsSuccess()),
        zip(
          conversations.map((conv) => DataService.deleteConversation(conv)), //TODO: delete folders
        ).pipe(switchMap(() => EMPTY)),
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
      const deleteConversations = conversations.filter((conv) =>
        deleteIds.has(conv.id),
      );

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
                otherConversations[otherConversations.length - 1].id,
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
          deleteConversations.map((conv) =>
            DataService.deleteConversation(conv),
          ),
        ).pipe(switchMap(() => EMPTY)),
      );
    }),
  );

const migrateConversationsEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(ConversationsActions.migrateConversations.match),
    switchMap(() =>
      forkJoin({
        conversations: browserStorage
          .getConversations()
          .pipe(map(filterOnlyMyEntities)),
        conversationsFolders: browserStorage
          .getConversationsFolders()
          .pipe(map(filterOnlyMyEntities)),
        migratedConversationIds: DataService.getMigratedEntityIds(
          MigrationStorageKeys.MigratedConversationIds,
        ),
        isConversationsMigrated: DataService.getIsEntitiesMigrated(
          MigrationStorageKeys.IsConversationsMigrated,
        ),
      }),
    ),
    switchMap(
      ({
        conversations,
        conversationsFolders,
        migratedConversationIds,
        isConversationsMigrated,
      }) => {
        const notMigratedConversations = filterNotMigratedEntities(
          conversations,
          migratedConversationIds,
        );

        if (
          SettingsSelectors.selectStorageType(state$.value) !==
            StorageType.API ||
          isConversationsMigrated ||
          !notMigratedConversations.length
        ) {
          return EMPTY;
        }

        const preparedConversations: Conversation[] = notMigratedConversations
          .sort((a, b) => {
            if (!a.lastActivityDate) return 1;
            if (!b.lastActivityDate) return -1;

            return a.lastActivityDate - b.lastActivityDate;
          })
          .map((conv) => {
            const { path } = getPathToFolderById(
              conversationsFolders,
              conv.folderId,
            );

            return {
              ...conv,
              name: conv.name.replace(notAllowedSymbolsRegex, ''),
              folderId: path,
            };
          }); // to send conversation with proper parentPath and lastActivityDate order

        let migratedConversationsCount = 0;

        return DataService.setConversations(preparedConversations).pipe(
          switchMap(() => {
            migratedConversationIds.push(
              preparedConversations[migratedConversationsCount].id,
            );
            migratedConversationsCount++;

            return concat(
              DataService.setMigratedEntitiesIds(
                migratedConversationIds,
                MigrationStorageKeys.MigratedConversationIds,
              ).pipe(switchMap(() => EMPTY)),
              of(
                ConversationsActions.migrateConversationSuccess({
                  migratedConversationsCount,
                  conversationsToMigrateCount: conversations.length,
                }),
              ),
            );
          }),
          finalize(() => {
            if (migratedConversationIds.length === conversations.length) {
              DataService.setIsEntitiesMigrated(
                true,
                MigrationStorageKeys.IsConversationsMigrated,
              );
            }

            return window.location.reload();
          }),
        );
      },
    ),
    catchError(() => {
      return of(); // TODO: show toast?
    }),
  );
};

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
      ).replaceAll(notAllowedSymbolsRegex, '');

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
            const convReplay = conversation!.replay;

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
        //ConversationsActions.createNewConversationsSuccess.match(action) ||
        //ConversationsActions.createNewConversationSuccess.match(action) ||
        ConversationsActions.importConversationsSuccess.match(action) ||
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
      concat(
        of(UIActions.setIsCompareMode(selectedConversationsIds.length > 1)),
        of(
          ConversationsActions.uploadConversations({
            conversationIds: selectedConversationsIds,
          }),
        ),
      ),
    ),
  );

// const saveConversationsEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(
//       (action) =>
//         //ConversationsActions.createNewConversationsSuccess.match(action) ||
//         //ConversationsActions.updateConversation.match(action) ||
//         //ConversationsActions.updateConversations.match(action) ||
//         ConversationsActions.importConversationsSuccess.match(action) ||
//         //ConversationsActions.deleteConversations.match(action) ||
//         //ConversationsActions.addConversations.match(action) ||
//         ConversationsActions.unpublishConversation.match(action) ||
//         ConversationsActions.duplicateSelectedConversations.match(action),
//     ),
//     map(() => ConversationsSelectors.selectConversations(state$.value)),
//     switchMap((conversations) => {
//       return DataService.setConversations(
//         (conversations as Conversation[]).filter(
//           (conv: Conversation) => !!conv.replay, //TODO: fix saving conversations
//         ),
//       );
//     }),
//     ignoreElements(),
//   );

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
        of(ConversationsActions.migrateConversations()),
        of(ConversationsActions.initFolders()),
        of(ConversationsActions.initConversations()),
      ),
    ),
  );

const uploadConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) => ConversationsActions.uploadConversations.match(action)),
    switchMap(({ payload }) => {
      const setIds = new Set(payload.conversationIds);
      const conversationInfos = ConversationsSelectors.selectConversations(
        state$.value,
      ).filter((conv) => setIds.has(conv.id));
      // && !(conv as Conversation).replay); // TODO: not upload twice
      return zip(
        conversationInfos.map((info) => DataService.getConversation(info)),
      );
    }),
    map((conversations) =>
      ConversationsActions.uploadConversationsSuccess({
        conversations: conversations.filter(Boolean) as Conversation[],
      }),
    ),
  );

const updateConversationDebounceEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) =>
      ConversationsActions.updateConversationDebounce.match(action),
    ),
    debounceTime(1000),
    switchMap(({ payload: newConversation }) => {
      return DataService.updateConversation(newConversation).pipe(
        switchMap(() => EMPTY),
      );
    }),
  );

const updateConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) => ConversationsActions.updateConversation.match(action)),
    switchMap(({ payload }) => {
      const { id, values } = payload;
      const conversation = ConversationsSelectors.selectConversation(
        state$.value,
        id,
      );
      const newConversation: Conversation = addGeneratedConversationId({
        ...(conversation as Conversation),
        ...values,
      });
      return concat(
        of(
          ConversationsActions.updateConversationSuccess({
            id,
            conversation: newConversation,
          }),
        ),
        iif(
          () =>
            !!conversation &&
            (conversation.model.id !== newConversation.model.id ||
              conversation.name !== newConversation.name),
          concat(
            DataService.createConversation(newConversation),
            DataService.deleteConversation(conversation!),
          ).pipe(switchMap(() => EMPTY)),
          of(ConversationsActions.updateConversationDebounce(newConversation)),
        ),
      );
    }),
  );

export const ConversationsEpics = combineEpics(
  initEpic,
  initConversationsEpic,
  migrateConversationsEpic,
  initFoldersEpic,

  selectConversationsEpic,
  createNewConversationsEpic,
  createNewConversationSuccessEpic,
  createNewConversationsSuccessEpic,
  //saveConversationsEpic,
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

  createNewReplayConversationEpic,
  createNewPlaybackConversationEpic,
  duplicateConversationEpic,
  uploadConversationsEpic,
  updateConversationEpic,
  updateConversationDebounceEpic,
);
