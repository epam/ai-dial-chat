import toast from 'react-hot-toast';

import { cleanConversationHistory } from '@/utils/app/clean';
import { DEFAULT_CONVERSATION_NAME } from '@/utils/app/const';
import {
  saveConversations,
  saveSelectedConversationIds,
} from '@/utils/app/conversation';
import { saveConversationsFolders } from '@/utils/app/folders';
import {
  CleanDataResponse,
  exportConversation,
  exportConversations,
  importData,
} from '@/utils/app/importExport';

import { Conversation } from '@/types/chat';
import { AppEpic } from '@/types/store';

import { AddonsActions } from '../addons/addons.reducers';
import { ModelsActions, ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from './conversations.reducers';

import { errorsMessages } from '@/constants/errors';
import { combineEpics } from 'redux-observable';
import {
  EMPTY,
  concat,
  filter,
  ignoreElements,
  iif,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';

const createNewConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.createNewConversations.match),
    map(({ payload }) => ({
      names: payload.names,
      lastConversation: ConversationsSelectors.selectLastConversation(
        state$.value,
      ),
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
      models: ModelsSelectors.selectModels(state$.value),
      defaultModelId: ModelsSelectors.selectDefaultModelId(state$.value),
    })),
    switchMap(
      ({ names, lastConversation, modelsMap, models, defaultModelId }) => {
        const model =
          (defaultModelId && modelsMap[defaultModelId]) || models[0];
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
      },
    ),
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
    map(() => ConversationsSelectors.selectFolders(state$.value)),
    tap((folders) => {
      saveConversationsFolders(folders);
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
          names: [DEFAULT_CONVERSATION_NAME],
        }),
      );
    }),
  );

const deleteConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ConversationsActions.deleteConversation.match),
    map(() => ConversationsSelectors.selectConversations(state$.value)),
    switchMap((conversations) => {
      if (conversations.length === 0) {
        return of(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
      }

      return EMPTY;
    }),
  );

const initConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ConversationsActions.initConversations.match),
    map(() => {
      const conversationHistory = localStorage.getItem('conversationHistory');
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
      const actions = [];
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
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          ),
        );
      }

      return concat(...actions);
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
);
