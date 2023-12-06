import { i18n } from 'next-i18next';

import { concat, filter, ignoreElements, map, of, switchMap, tap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import {
  exportPrompt,
  exportPrompts,
  importPrompts,
} from '@/src/utils/app/import-export';

import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { UIActions } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

const savePromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createNewPrompt.match(action) ||
        PromptsActions.deletePrompts.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.updatePrompt.match(action) ||
        PromptsActions.importPromptsSuccess.match(action),
    ),
    map(() => PromptsSelectors.selectPrompts(state$.value)),
    switchMap((prompts) => {
      return DataService.setPrompts(prompts);
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
        PromptsActions.moveFolder.match(action) ||
        PromptsActions.shareFolder.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.importPromptsSuccess.match(action),
    ),
    map(() => ({
      promptsFolders: PromptsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ promptsFolders }) => {
      return DataService.setPromptFolders(promptsFolders);
    }),
    ignoreElements(),
  );

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.deleteFolder.match),
    map(({ payload }) => ({
      prompts: PromptsSelectors.selectPrompts(state$.value),
      childFolders: PromptsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.folderId,
      ),
      folders: PromptsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ prompts, childFolders, folders }) => {
      const removedPromptsIds = prompts
        .filter(
          (prompt) => prompt.folderId && childFolders.includes(prompt.folderId),
        )
        .map(({ id }) => id);

      return concat(
        of(
          PromptsActions.deletePrompts({
            promptIds: removedPromptsIds,
          }),
        ),
        of(
          PromptsActions.setFolders({
            folders: folders.filter(
              (folder) => !childFolders.includes(folder.id),
            ),
          }),
        ),
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

const exportPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.exportPrompt.match),
    map(({ payload }) =>
      PromptsSelectors.selectPrompt(state$.value, payload.promptId),
    ),
    filter(Boolean),
    tap((prompt) => {
      exportPrompt(
        prompt,
        PromptsSelectors.selectParentFolders(state$.value, prompt.folderId),
      );
    }),
    ignoreElements(),
  );

const importPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.importPrompts.match),
    map(({ payload }) => {
      const prompts = PromptsSelectors.selectPrompts(state$.value);
      const folders = PromptsSelectors.selectFolders(state$.value);

      return importPrompts(payload.promptsHistory, {
        currentFolders: folders,
        currentPrompts: prompts,
      });
    }),
    switchMap(({ prompts, folders, isError }) => {
      if (isError) {
        return of(
          UIActions.showToast({
            message: (i18n as any).t(errorsMessages.unsupportedDataFormat, {
              ns: 'common',
            }),
            type: 'error',
          }),
        );
      }

      return of(PromptsActions.importPromptsSuccess({ prompts, folders }));
    }),
  );

const initFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => PromptsActions.initFolders.match(action)),
    switchMap(() =>
      DataService.getPromptsFolders().pipe(
        map((folders) => {
          return PromptsActions.setFolders({
            folders,
          });
        }),
      ),
    ),
  );

const initPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.init.match),
    switchMap(() =>
      DataService.getPrompts().pipe(
        map((prompts) => {
          return PromptsActions.updatePrompts({
            prompts,
          });
        }),
      ),
    ),
  );

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => PromptsActions.init.match(action)),
    switchMap(() =>
      concat(
        of(PromptsActions.initFolders()),
        of(PromptsActions.initPrompts()),
      ),
    ),
  );

export const PromptsEpics = combineEpics(
  initEpic,
  initPromptsEpic,
  initFoldersEpic,
  savePromptsEpic,
  saveFoldersEpic,
  deleteFolderEpic,
  exportPromptsEpic,
  exportPromptEpic,
  importPromptsEpic,
);
