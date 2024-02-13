import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  filter,
  forkJoin,
  from,
  ignoreElements,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
  zip,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import {
  combineEntities,
  filterMigratedEntities,
  filterOnlyMyEntities,
  updateEntitiesFoldersAndIds,
} from '@/src/utils/app/common';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { constructPath, notAllowedSymbolsRegex } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  generateNextName,
  getAllPathsFromPath,
  getFolderFromPath,
  getNextDefaultName,
  getPathToFolderById,
  splitPath,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import {
  exportPrompt,
  exportPrompts,
  importPrompts,
} from '@/src/utils/app/import-export';
import { addGeneratedPromptId } from '@/src/utils/app/prompts';
import { translate } from '@/src/utils/app/translation';
import { getPromptApiKey, parsePromptApiKey } from '@/src/utils/server/api';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { UIActions, UISelectors } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { RootState } from '@/src/store';

const createNewPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.createNewPrompt.match),
    switchMap(() => {
      const prompts = PromptsSelectors.selectPrompts(state$.value);

      const newPrompt: Prompt = addGeneratedPromptId({
        name: getNextDefaultName(
          DEFAULT_PROMPT_NAME,
          prompts.filter((prompt) => !prompt.folderId),
        ),
        description: '',
        content: '',
      });

      return of(PromptsActions.createNewPromptSuccess({ newPrompt }));
    }),
  );

const createNewPromptSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.createNewPromptSuccess.match),
    switchMap(({ payload }) =>
      PromptService.createPrompt(payload.newPrompt).pipe(
        switchMap(() => EMPTY), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
      ),
    ),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createFolder.match(action) ||
        PromptsActions.deleteFolder.match(action) ||
        PromptsActions.addFolders.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.importPromptsSuccess.match(action) ||
        PromptsActions.unpublishFolder.match(action) ||
        PromptsActions.setFolders.match(action),
    ),
    map(() => ({
      promptsFolders: PromptsSelectors.selectFolders(state$.value),
    })),
    switchMap(({ promptsFolders }) => {
      return PromptService.setPromptFolders(promptsFolders);
    }),
    ignoreElements(),
  );

const getOrUploadPrompt = (
  payload: { id: string },
  state: RootState,
): Observable<{
  prompt: Prompt | null;
  payload: { id: string };
}> => {
  const prompt = PromptsSelectors.selectPrompt(state, payload.id);

  if (prompt?.status !== UploadStatus.LOADED) {
    const { name, parentPath } = splitPath(payload.id);
    const prompt = addGeneratedPromptId({
      name,
      folderId: parentPath,
    });

    return forkJoin({
      prompt: PromptService.getPrompt(prompt),
      payload: of(payload),
    });
  } else {
    return forkJoin({
      prompt: of(prompt),
      payload: of(payload),
    });
  }
};

const savePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.savePrompt.match),
    switchMap(({ payload: newPrompt }) => {
      return PromptService.updatePrompt(newPrompt).pipe(
        switchMap(() => EMPTY), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
      );
    }),
  );

const recreatePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.recreatePrompt.match),
    mergeMap(({ payload }) => {
      return concat(
        PromptService.createPrompt(payload.new).pipe(
          switchMap(() => EMPTY), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
        ),
        PromptService.deletePrompt(parsePromptApiKey(payload.old.id)).pipe(
          switchMap(() => EMPTY),
        ), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
      );
    }),
  );

const updatePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.updatePrompt.match),
    mergeMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),
    mergeMap(({ payload, prompt }) => {
      const { values, id } = payload as {
        id: string;
        values: Partial<Prompt>;
      };

      if (!prompt) {
        return EMPTY; // TODO: handle?
      }

      const newPrompt: Prompt = {
        ...prompt,
        ...values,
        id: constructPath(
          values.folderId || prompt.folderId,
          getPromptApiKey({ ...prompt, ...values }),
        ),
      };

      return concat(
        of(PromptsActions.updatePromptSuccess({ prompt: newPrompt, id })),
        iif(
          () => !!prompt && prompt.id !== newPrompt.id,
          of(PromptsActions.recreatePrompt({ old: prompt, new: newPrompt })),
          of(PromptsActions.savePrompt(newPrompt)),
        ),
      );
    }),
  );

export const deletePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.deletePrompt.match),
    switchMap(({ payload }) => {
      return PromptService.deletePrompt(payload.prompt).pipe(
        switchMap(() => EMPTY), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
      );
    }),
  );

export const clearPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.clearPrompts.match),
    switchMap(() =>
      concat(
        of(PromptsActions.clearPromptsSuccess()),
        of(PromptsActions.deleteFolder({})),
      ),
    ),
  );

const deletePromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.deletePrompts.match),
    map(({ payload }) => ({
      deletePrompts: payload.promptsToRemove,
    })),
    switchMap(({ deletePrompts }) =>
      concat(
        of(
          PromptsActions.deletePromptsSuccess({
            deletePrompts,
          }),
        ),
        zip(deletePrompts.map((id) => PromptService.deletePrompt(id))).pipe(
          switchMap(() => EMPTY), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
        ),
      ),
    ),
  );

const updateFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.updateFolder.match),
    switchMap(({ payload }) => {
      const folder = getFolderFromPath(payload.folderId, FolderType.Prompt);
      const newFolder = addGeneratedFolderId({ ...folder, ...payload.values });

      if (payload.folderId === newFolder.id) {
        return EMPTY;
      }

      return PromptService.getPrompts(payload.folderId, true).pipe(
        switchMap((prompts) => {
          const updateFolderId = updateMovedFolderId.bind(
            null,
            payload.folderId,
            newFolder.id,
          );

          const folders = PromptsSelectors.selectFolders(state$.value);
          const allPrompts = PromptsSelectors.selectPrompts(state$.value);
          const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
            state$.value,
            FeatureType.Prompt,
          );

          const { updatedFolders, updatedOpenedFoldersIds } =
            updateEntitiesFoldersAndIds(
              prompts,
              folders,
              updateFolderId,
              openedFoldersIds,
            );

          const updatedPrompts = combineEntities(
            allPrompts.map((prompt) =>
              addGeneratedPromptId({
                ...prompt,
                folderId: updateFolderId(prompt.folderId),
              }),
            ),
            prompts.map((prompt) =>
              addGeneratedPromptId({
                ...prompt,
                folderId: updateFolderId(prompt.folderId),
              }),
            ),
          );

          const actions: Observable<AnyAction>[] = [];
          actions.push(
            of(
              PromptsActions.updateFolderSuccess({
                folders: updatedFolders,
                prompts: updatedPrompts,
              }),
            ),
            of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: updatedOpenedFoldersIds,
                featureType: FeatureType.Prompt,
              }),
            ),
          );
          if (prompts.length) {
            prompts.forEach((prompt) => {
              actions.push(
                of(
                  PromptsActions.updatePrompt({
                    id: prompt.id,
                    values: {
                      folderId: updateFolderId(prompt.folderId),
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

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.deleteFolder.match),
    switchMap(({ payload }) =>
      forkJoin({
        folderId: of(payload.folderId),
        promptsToRemove: PromptService.getPrompts(payload.folderId, true),
        folders: of(PromptsSelectors.selectFolders(state$.value)),
      }),
    ),
    switchMap(({ folderId, promptsToRemove, folders }) => {
      const childFolders = new Set([
        folderId,
        ...promptsToRemove.flatMap((prompt) =>
          getAllPathsFromPath(prompt.folderId),
        ),
      ]);
      const actions: Observable<AnyAction>[] = [];
      actions.push(
        of(
          PromptsActions.setFolders({
            folders: folders.filter((folder) => !childFolders.has(folder.id)),
          }),
        ),
      );

      if (promptsToRemove.length) {
        actions.push(
          of(
            PromptsActions.deletePrompts({
              promptsToRemove,
            }),
          ),
        );
      }

      return concat(...actions);
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
      //TODO: upload all prompts for export - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
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
      //TODO: upload all prompts for export - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
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
      //TODO: save in API - will be implemented in https://github.com/epam/ai-dial-chat/issues/640
      return importPrompts(payload.promptsHistory, {
        currentFolders: folders,
        currentPrompts: prompts,
      });
    }),
    switchMap(({ prompts, folders, isError }) => {
      if (isError) {
        return of(
          UIActions.showToast({
            message: translate(errorsMessages.unsupportedDataFormat, {
              ns: 'common',
            }),
            type: 'error',
          }),
        );
      }

      return of(PromptsActions.importPromptsSuccess({ prompts, folders }));
    }),
  );

const migratePromptsIfRequiredEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(PromptsActions.migratePromptsIfRequired.match),
    switchMap(() =>
      forkJoin({
        prompts: browserStorage.getPrompts().pipe(map(filterOnlyMyEntities)),
        promptsFolders: browserStorage
          .getPromptsFolders(undefined, true)
          .pipe(map(filterOnlyMyEntities)),
        migratedPromptIds: BrowserStorage.getMigratedEntityIds(
          MigrationStorageKeys.MigratedPromptIds,
        ),
        failedMigratedPromptIds: BrowserStorage.getFailedMigratedEntityIds(
          MigrationStorageKeys.FailedMigratedPromptIds,
        ),
      }),
    ),
    switchMap(
      ({
        prompts,
        promptsFolders,
        migratedPromptIds,
        failedMigratedPromptIds,
      }) => {
        const notMigratedPrompts = filterMigratedEntities(
          prompts,
          [...migratedPromptIds, ...failedMigratedPromptIds],
          true,
        );

        if (
          SettingsSelectors.selectStorageType(state$.value) !==
            StorageType.API ||
          !notMigratedPrompts.length
        ) {
          if (failedMigratedPromptIds.length) {
            return of(
              PromptsActions.setFailedMigratedPrompts({
                failedMigratedPrompts: filterMigratedEntities(
                  prompts,
                  failedMigratedPromptIds,
                ),
              }),
            );
          }
          return EMPTY;
        }

        const preparedPrompts: Prompt[] = notMigratedPrompts.map((prompt) => {
          const { path } = getPathToFolderById(
            promptsFolders,
            prompt.folderId,
            true,
          );
          const newName = prompt.name.replace(notAllowedSymbolsRegex, '');

          return {
            ...prompt,
            id: constructPath(...[path, newName]),
            name: newName,
            folderId: path,
          };
        }); // to send prompts with proper parentPath
        let migratedPromptsCount = 0;

        return concat(
          of(
            PromptsActions.initPromptsMigration({
              promptsToMigrateCount: notMigratedPrompts.length,
            }),
          ),
          from(preparedPrompts).pipe(
            concatMap((prompt) =>
              PromptService.setPrompts([prompt]).pipe(
                switchMap(() => {
                  migratedPromptIds.push(
                    notMigratedPrompts[migratedPromptsCount].id,
                  );

                  return concat(
                    BrowserStorage.setMigratedEntitiesIds(
                      migratedPromptIds,
                      MigrationStorageKeys.MigratedPromptIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      PromptsActions.migratePromptFinish({
                        migratedPromptsCount: ++migratedPromptsCount,
                      }),
                    ),
                  );
                }),
                catchError(() => {
                  failedMigratedPromptIds.push(
                    notMigratedPrompts[migratedPromptsCount].id,
                  );

                  return concat(
                    BrowserStorage.setFailedMigratedEntityIds(
                      failedMigratedPromptIds,
                      MigrationStorageKeys.FailedMigratedPromptIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      PromptsActions.migratePromptFinish({
                        migratedPromptsCount: ++migratedPromptsCount,
                      }),
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      },
    ),
  );
};

export const skipFailedMigratedPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.skipFailedMigratedPrompts.match),
    switchMap(({ payload }) =>
      BrowserStorage.getMigratedEntityIds(
        MigrationStorageKeys.MigratedPromptIds,
      ).pipe(
        switchMap((migratedPromptIds) =>
          concat(
            BrowserStorage.setMigratedEntitiesIds(
              [...payload.idsToMarkAsMigrated, ...migratedPromptIds],
              MigrationStorageKeys.MigratedPromptIds,
            ).pipe(switchMap(() => EMPTY)),
            BrowserStorage.setFailedMigratedEntityIds(
              [],
              MigrationStorageKeys.FailedMigratedPromptIds,
            ).pipe(switchMap(() => EMPTY)),
            of(
              PromptsActions.setFailedMigratedPrompts({
                failedMigratedPrompts: [],
              }),
            ),
          ),
        ),
      ),
    ),
  );

const initPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.initPrompts.match),
    switchMap(() => PromptService.getPrompts(undefined, true)),
    switchMap((prompts) => {
      return concat(
        of(
          PromptsActions.updatePrompts({
            prompts,
          }),
        ),
        of(
          PromptsActions.setFolders({
            folders: Array.from(
              new Set(prompts.flatMap((p) => getAllPathsFromPath(p.folderId))),
            ).map((path) => getFolderFromPath(path, FolderType.Prompt)),
          }),
        ),
      );
    }),
  );

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => PromptsActions.init.match(action)),
    switchMap(() =>
      concat(
        // of(PromptsActions.initFolders()),
        of(PromptsActions.initPrompts()),
      ),
    ),
  );

export const uploadPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.uploadPrompt.match),
    switchMap(({ payload }) => {
      const originalPrompt = PromptsSelectors.selectPrompt(
        state$.value,
        payload.promptId,
      ) as PromptInfo;

      return PromptService.getPrompt(originalPrompt).pipe(
        map((servicePrompt) => ({ originalPrompt, servicePrompt })),
      );
    }),
    map(({ servicePrompt, originalPrompt }) => {
      return PromptsActions.uploadPromptSuccess({
        prompt: servicePrompt,
        originalPromptId: originalPrompt.id,
      });
    }),
  );

export const duplicatePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.duplicatePrompt.match),
    switchMap(({ payload }) =>
      forkJoin({
        prompt: PromptService.getPrompt(payload),
      }),
    ),
    switchMap(({ prompt }) => {
      if (!prompt) return EMPTY;

      const prompts = PromptsSelectors.selectPrompts(state$.value);

      const newPrompt: Prompt = addGeneratedPromptId({
        ...prompt,
        ...resetShareEntity,
        folderId: undefined,
        name: generateNextName(
          DEFAULT_PROMPT_NAME,
          prompt.name,
          prompts.filter((p) => !p.folderId),
        ),
      });

      return of(
        PromptsActions.createNewPromptSuccess({
          newPrompt,
        }),
      );
    }),
  );

export const PromptsEpics = combineEpics(
  migratePromptsIfRequiredEpic,
  skipFailedMigratedPromptsEpic,
  // init
  initEpic,
  initPromptsEpic,

  saveFoldersEpic,
  deleteFolderEpic,
  exportPromptsEpic,
  exportPromptEpic,
  importPromptsEpic,
  savePromptEpic,
  recreatePromptEpic,
  updatePromptEpic,
  deletePromptEpic,
  clearPromptsEpic,
  deletePromptsEpic,
  updateFolderEpic,
  createNewPromptEpic,
  createNewPromptSuccessEpic,
  duplicatePromptEpic,

  uploadPromptEpic,
);
