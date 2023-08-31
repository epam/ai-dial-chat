import { toast } from 'react-hot-toast';

import { savePromptsFolders } from '@/utils/app/folders';
import { exportPrompts, importPrompts } from '@/utils/app/importExport';
import { savePrompts } from '@/utils/app/prompts';

import { AppEpic } from '@/types/store';

import { ModelsSelectors } from '../models/models.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { errorsMessages } from '@/constants/errors';
import { combineEpics } from 'redux-observable';
import { EMPTY, filter, ignoreElements, map, of, switchMap, tap } from 'rxjs';

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
    map(() => PromptsSelectors.selectFolders(state$.value)),
    tap((folders) => {
      savePromptsFolders(folders);
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
        toast.error(errorsMessages.unsupportedDataFormat);
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
