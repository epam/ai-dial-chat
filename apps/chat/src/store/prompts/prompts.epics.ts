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
import {
  PromptService,
  getImportPreparedPrompts,
  getPreparedPrompts,
} from '@/src/utils/app/data/prompt-service';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  generateNextName,
  getFolderFromId,
  getFoldersFromIds,
  getNextDefaultName,
  getParentFolderIdsFromFolderId,
  splitEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getRootId, isRootId } from '@/src/utils/app/id';
import {
  exportPrompt,
  exportPrompts,
  isPromptsFormat,
} from '@/src/utils/app/import-export';
import { addGeneratedPromptId } from '@/src/utils/app/prompts';
import { translate } from '@/src/utils/app/translation';
import { ApiKeys, getPromptApiKey } from '@/src/utils/server/api';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { ImportExportActions } from '../import-export/importExport.reducers';
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
          prompts.filter((prompt) => isRootId(prompt.folderId)),
        ),
        description: '',
        content: '',
        folderId: getRootId({ apiKey: ApiKeys.Prompts }),
      });
      return PromptService.createPrompt(newPrompt).pipe(
        switchMap(() =>
          concat(
            of(PromptsActions.createNewPromptSuccess({ newPrompt })),
            of(PromptsActions.setIsPromptRequestSent(false)),
          ),
        ),
        catchError((err) => {
          console.error("New prompt wasn't created:", err);
          return concat(
            of(
              UIActions.showErrorToast(
                translate(
                  'An error occurred while creating a new prompt. Most likely the prompt already exists. Please refresh the page.',
                ),
              ),
            ),
            of(PromptsActions.setIsPromptRequestSent(false)),
          );
        }),
      );
    }),
  );

const saveNewPromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.saveNewPrompt.match),
    switchMap(({ payload }) =>
      PromptService.createPrompt(payload.newPrompt).pipe(
        switchMap(() => of(PromptsActions.createNewPromptSuccess(payload))),
        catchError((err) => {
          console.error(err);
          return of(
            UIActions.showErrorToast(
              translate(
                'An error occurred while saving the prompt. Most likely the prompt already exists. Please refresh the page.',
              ),
            ),
          );
        }),
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
      return PromptService.setPromptFolders(promptsFolders).pipe(
        catchError((err) => {
          console.error('An error occurred during the saving folders', err);
          return of(
            UIActions.showErrorToast(
              translate('An error occurred during the saving folders'),
            ),
          );
        }),
      );
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
    const { apiKey, bucket, name, parentPath } = splitEntityId(payload.id);
    const prompt = addGeneratedPromptId({
      name,
      folderId: constructPath(apiKey, bucket, parentPath),
    });

    return forkJoin({
      prompt: PromptService.getPrompt(prompt).pipe(
        catchError((err) => {
          console.error('The prompt was not found:', err);
          return of(null);
        }),
      ),
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
    switchMap(({ payload: newPrompt }) =>
      PromptService.updatePrompt(newPrompt).pipe(switchMap(() => EMPTY)),
    ),
    catchError((err) => {
      console.error(err);
      return of(
        UIActions.showErrorToast(
          translate(
            'An error occurred while saving the prompt. Most likely the prompt already exists. Please refresh the page.',
          ),
        ),
      );
    }),
  );

const recreatePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.recreatePrompt.match),
    mergeMap(({ payload }) => {
      const { parentPath } = splitEntityId(payload.old.id);
      return zip(
        PromptService.createPrompt(payload.new),
        PromptService.deletePrompt({
          id: payload.old.id,
          folderId: parentPath || getRootId({ apiKey: ApiKeys.Prompts }),
          name: payload.old.name,
        }),
      ).pipe(
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return of(
            UIActions.showErrorToast(
              translate(
                'An error occurred while saving the prompt. Please refresh the page.',
              ),
            ),
          );
        }),
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
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this prompt has been deleted. Please reload the page',
            ),
          ),
        );
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
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return of(
            UIActions.showErrorToast(
              translate(
                `An error occurred while removing the prompt "${payload.prompt.name}"`,
              ),
            ),
          );
        }),
      );
    }),
  );

export const clearPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.clearPrompts.match),
    switchMap(() =>
      concat(
        of(PromptsActions.setIsPromptRequestSent(true)),
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
      zip(
        deletePrompts.map((info) =>
          PromptService.deletePrompt(info).pipe(
            switchMap(() => of(null)),
            catchError((err) => {
              console.error(
                `An error occurred while deleting the prompt "${info.name}"`,
                err,
              );
              return of(info.name);
            }),
          ),
        ),
      ).pipe(
        switchMap((failedNames) =>
          concat(
            iif(
              () => failedNames.filter(Boolean).length > 0,
              of(
                UIActions.showErrorToast(
                  translate(
                    `An error occurred while removing the prompt(s): "${failedNames.filter(Boolean).join('", "')}"`,
                  ),
                ),
              ),
              EMPTY,
            ),
            of(
              PromptsActions.deletePromptsComplete({
                deletePrompts,
              }),
            ),
            of(PromptsActions.setIsPromptRequestSent(false)),
          ),
        ),
      ),
    ),
  );

const updateFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.updateFolder.match),
    switchMap(({ payload }) => {
      const folder = getFolderFromId(payload.folderId, FolderType.Prompt);
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
        catchError((err) => {
          console.error('An error occurred while updating the folder:', err);
          return of(
            UIActions.showErrorToast(
              translate('An error occurred while updating the folder.'),
            ),
          );
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
        promptsToRemove: PromptService.getPrompts(payload.folderId, true).pipe(
          catchError((err) => {
            console.error(
              'An error occurred while uploading prompts and folders:',
              err,
            );
            return [];
          }),
        ),
        folders: of(PromptsSelectors.selectFolders(state$.value)),
      }),
    ),
    switchMap(({ folderId, promptsToRemove, folders }) => {
      const childFolders = new Set([
        folderId,
        ...promptsToRemove.map((prompt) => prompt.folderId),
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
      } else {
        actions.push(of(PromptsActions.setIsPromptRequestSent(false)));
      }

      return concat(...actions);
    }),
  );

const toggleFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.toggleFolder.match),
    switchMap(({ payload }) => {
      const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
        state$.value,
        FeatureType.Prompt,
      );
      const isOpened = openedFoldersIds.includes(payload.id);
      const action = isOpened ? UIActions.closeFolder : UIActions.openFolder;
      return of(
        action({
          id: payload.id,
          featureType: FeatureType.Prompt,
        }),
      );
    }),
  );

const openFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        UIActions.openFolder.match(action) &&
        action.payload.featureType === FeatureType.Prompt,
    ),
    switchMap(({ payload }) => {
      const folder = PromptsSelectors.selectFolders(state$.value).find(
        (f) => f.id === payload.id,
      );
      if (folder?.status === UploadStatus.LOADED) {
        return EMPTY;
      }
      return concat(
        of(
          PromptsActions.uploadChildPromptsWithFolders({
            paths: [payload.id],
            inheritedMetadata: {
              sharedWithMe: folder?.sharedWithMe,
              sharedWithMeChild: true,
            },
          }),
        ),
      );
    }),
  );

const duplicatePromptEpic: AppEpic = (action$, state$) =>
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
      const newPrompt = addGeneratedPromptId({
        ...prompt,
        ...resetShareEntity,
        folderId: getRootId({ apiKey: ApiKeys.Prompts }),
        name: generateNextName(
          DEFAULT_PROMPT_NAME,
          prompt.name,
          prompts.filter((prompt) => isRootId(prompt.folderId)),
        ),
      });

      return of(PromptsActions.saveNewPrompt({ newPrompt }));
    }),
  );

const exportPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.exportPrompts.match),
    switchMap(() =>
      //listing of all entities
      PromptService.getPrompts(undefined, true).pipe(
        catchError((err) => {
          console.error(
            'An error occurred while uploading prompts and folders:',
            err,
          );
          return [];
        }),
      ),
    ),
    switchMap((promptsListing) => {
      const onlyMyPromptsListing = filterOnlyMyEntities(promptsListing);
      const foldersIds = Array.from(
        new Set(onlyMyPromptsListing.map((info) => info.folderId)),
      );
      //calculate all folders;
      const folders = getFoldersFromIds(
        Array.from(
          new Set(
            foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
          ),
        ),
        FolderType.Prompt,
      );

      return forkJoin({
        //get all prompts from api
        prompts: zip(
          onlyMyPromptsListing.map((info) => PromptService.getPrompt(info)),
        ).pipe(
          catchError((err) => {
            console.error('An error occurred while uploading prompts:', err);
            return [];
          }),
        ),
        folders: of(folders),
      });
    }),
    tap(({ prompts, folders }) => {
      const filteredPrompts = prompts.filter(Boolean) as Prompt[];

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportPrompts(filteredPrompts, folders, appName);
    }),
    ignoreElements(),
  );

const exportPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.exportPrompt.match),
    switchMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),

    switchMap((promptAndPayload) => {
      const { prompt } = promptAndPayload;
      if (!prompt) {
        return of(ImportExportActions.exportFail());
      }

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportPrompt(
        prompt,
        PromptsSelectors.selectParentFolders(state$.value, prompt.folderId),
        appName,
      );
      return EMPTY;
    }),
  );

const importPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.importPrompts.match),
    switchMap(({ payload }) => {
      const { promptsHistory } = payload;

      if (!isPromptsFormat(promptsHistory)) {
        return concat(
          of(ImportExportActions.importPromptsFail()),
          of(
            UIActions.showErrorToast(
              translate(errorsMessages.unsupportedDataFormat, {
                ns: 'common',
              }),
            ),
          ),
        );
      }

      const preparedPrompts: Prompt[] = getImportPreparedPrompts({
        prompts: promptsHistory.prompts,
        folders: promptsHistory.folders,
      });

      return PromptService.setPrompts(preparedPrompts).pipe(
        switchMap(() => {
          return PromptService.getPrompts(undefined, true).pipe(
            catchError((err) => {
              console.error(
                'An error occurred while uploading prompts and folders:',
                err,
              );
              return [];
            }),
          ); //listing of all entities
        }),
        switchMap((promptsListing) => {
          if (!promptsListing.length) {
            return of(ImportExportActions.importPromptsFail());
          }

          const foldersIds = Array.from(
            new Set(promptsListing.map((info) => info.folderId)),
          );
          //calculate all folders;
          const folders = getFoldersFromIds(
            Array.from(
              new Set(
                foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
              ),
            ),
            FolderType.Prompt,
          );

          return of(
            PromptsActions.importPromptsSuccess({
              prompts: promptsListing,
              folders,
            }),
          );
        }),
      );
    }),
    catchError(() => of(ImportExportActions.importPromptsFail())),
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

        const preparedPrompts: Prompt[] = getPreparedPrompts({
          prompts: notMigratedPrompts,
          folders: promptsFolders,
          addRoot: true,
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

const uploadPromptsWithFoldersRecursiveEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.uploadPromptsWithFoldersRecursive.match),
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
              new Set(
                prompts.flatMap((p) =>
                  getParentFolderIdsFromFolderId(p.folderId),
                ),
              ),
            ).map((path) => ({
              ...getFolderFromId(path, FolderType.Prompt),
              status: UploadStatus.LOADED,
            })),
          }),
        ),
        of(PromptsActions.initPromptsSuccess()),
      );
    }),
    catchError((err) => {
      console.error(
        'An error occurred while uploading prompts and folders:',
        err,
      );
      return [];
    }),
  );

const uploadPromptsWithFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.uploadChildPromptsWithFolders.match),
    switchMap(({ payload }) =>
      zip(
        payload.paths.map((path) => PromptService.getPromptsAndFolders(path)),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const folders = foldersAndEntities
            .flatMap((f) => f.folders)
            .map((item) => ({
              ...item,
              ...(payload.inheritedMetadata as Partial<FolderInterface>),
              status: UploadStatus.LOADED,
            }));
          const prompts = foldersAndEntities
            .flatMap((f) => f.entities)
            .map((item) => ({
              ...item,
              ...(payload.inheritedMetadata as Partial<PromptInfo>),
            }));
          return of(
            PromptsActions.uploadChildPromptsWithFoldersSuccess({
              parentIds: payload.paths,
              folders,
              prompts,
            }),
          );
        }),
        catchError((err) => {
          console.error('Error during upload prompts and folders', err);
          return of(
            UIActions.showErrorToast(
              translate('Error during upload prompts and folders'),
            ),
          );
        }),
      ),
    ),
  );

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => PromptsActions.init.match(action)),
    switchMap(() =>
      concat(of(PromptsActions.uploadPromptsWithFoldersRecursive())),
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
    catchError((err) => {
      console.error('An error occurred while uploading the prompt:', err);
      return of(
        UIActions.showErrorToast(
          translate('An error occurred while uploading the prompt'),
        ),
      );
    }),
  );

export const PromptsEpics = combineEpics(
  migratePromptsIfRequiredEpic,
  skipFailedMigratedPromptsEpic,
  initEpic,
  uploadPromptsWithFoldersRecursiveEpic,
  uploadPromptsWithFoldersEpic,
  openFolderEpic,
  toggleFolderEpic,
  saveFoldersEpic,
  saveNewPromptEpic,
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
  duplicatePromptEpic,
  uploadPromptEpic,
  // importPromptsSuccessEpic,
);
