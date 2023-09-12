import { i18n } from 'next-i18next';

import { EMPTY, filter, ignoreElements, map, of, switchMap, tap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { saveFolders } from '@/src/utils/app/folders';
import { exportPrompts, importPrompts } from '@/src/utils/app/import-export';
import { savePrompts } from '@/src/utils/app/prompts';

import { AppEpic } from '@/src/types/store';

import { ConversationsSelectors } from '../conversations/conversations.reducers';
import { ModelsSelectors } from '../models/models.reducers';
import { UIActions } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { errorsMessages } from '@/src/constants/errors';

const createNewPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.createNewPrompt.match),
    map(() => ({
      models: ModelsSelectors.selectModels(state$.value),
      modelsMap: ModelsSelectors.selectModelsMap(state$.value),
      defaultModelId: ModelsSelectors.selectDefaultModelId(state$.value),
    })),
    switchMap(({ modelsMap, defaultModelId, models }) => {
      const model = (defaultModelId && modelsMap[defaultModelId]) || models[0];
      if (!model) {
        return EMPTY;
      }

      return of(
        PromptsActions.createNewPromptSuccess({
          model,
        }),
      );
    }),
  );

const savePromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createNewPromptSuccess.match(action) ||
        PromptsActions.deletePrompt.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.updatePrompt.match(action) ||
        PromptsActions.importPromptsSuccess.match(action),
    ),
    map(() => PromptsSelectors.selectPrompts(state$.value)),
    tap((prompts) => {
      savePrompts(prompts);
    }),
    ignoreElements(),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createFolder.match(action) ||
        PromptsActions.deleteFolder.match(action) ||
        PromptsActions.renameFolder.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.importPromptsSuccess.match(action),
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
    filter(PromptsActions.deleteFolder.match),
    map(({ payload }) => ({
      prompts: PromptsSelectors.selectPrompts(state$.value),
      folderId: payload.folderId,
    })),
    switchMap(({ folderId, prompts }) => {
      return of(
        PromptsActions.updatePrompts({
          prompts: prompts.map((c) => {
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

const exportPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.exportPrompts.match),
    map(() => ({
      prompts: PromptsSelectors.selectPrompts(state$.value),
      folders: PromptsSelectors.selectFolders(state$.value),
    })),
    tap(({ prompts, folders }) => {
      exportPrompts(prompts, folders);
    }),
    ignoreElements(),
  );

const importPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.importPrompts.match),
    map(({ payload }) => importPrompts(payload.promptsHistory)),
    switchMap(({ prompts, folders, isError }) => {
      if (isError) {
        of(
          UIActions.showToast({
            message: (i18n as any).t(errorsMessages.unsupportedDataFormat, {
              ns: 'common',
            }),
            type: 'error',
          }),
        );
        return EMPTY;
      }

      return of(PromptsActions.importPromptsSuccess({ prompts, folders }));
    }),
  );

export const PromptsEpics = combineEpics(
  createNewPromptEpic,
  savePromptsEpic,
  saveFoldersEpic,
  deleteFoldersEpic,
  exportPromptsEpic,
  importPromptsEpic,
);
