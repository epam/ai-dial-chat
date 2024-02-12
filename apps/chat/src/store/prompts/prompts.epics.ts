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
  findRootFromItems,
  getAllPathsFromPath,
  getFolderFromPath,
  getFolderIdByPath,
  getPathToFolderById,
  getTemporaryFoldersToPublish,
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
import { getPromptApiKey } from '@/src/utils/server/api';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import { errorsMessages } from '@/src/constants/errors';

import { UIActions, UISelectors } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { RootState } from '@/src/store';
import { v4 as uuidv4 } from 'uuid';

const savePromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createNewPrompt.match(action) ||
        PromptsActions.addPrompts.match(action) ||
        PromptsActions.importPromptsSuccess.match(action) ||
        PromptsActions.unpublishPrompt.match(action) ||
        PromptsActions.duplicatePrompt.match(action),
    ),
    map(() => PromptsSelectors.selectPrompts(state$.value)),
    switchMap((prompts) => {
      return PromptService.setPrompts(prompts);
    }),
    ignoreElements(),
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
        PromptService.deletePrompt(prompt).pipe(switchMap(() => EMPTY)), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
        PromptService.updatePrompt(newPrompt).pipe(switchMap(() => EMPTY)), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
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

// const initFoldersEpic: AppEpic = (action$) =>
//   action$.pipe(
//     filter((action) => PromptsActions.initFolders.match(action)),
//     switchMap(() =>
//       PromptService.getPromptsFolders().pipe(
//         map((folders) => {
//           return PromptsActions.setFolders({
//             folders,
//           });
//         }),
//       ),
//     ),
//   );

const migratePromptsEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(PromptsActions.migratePrompts.match),
    switchMap(() =>
      forkJoin({
        prompts: browserStorage.getPrompts().pipe(map(filterOnlyMyEntities)),
        promptsFolders: browserStorage
          .getPromptsFolders()
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
          const { path } = getPathToFolderById(promptsFolders, prompt.folderId);
          const newName = prompt.name.replace(notAllowedSymbolsRegex, '');

          return {
            ...prompt,
            id: constructPath(...[path, newName]),
            name: newName,
            folderId: path.replace(notAllowedSymbolsRegex, ''),
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

//TODO: added for development purpose - emulate immediate sharing with yourself
// const shareFolderEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(PromptsActions.shareFolder.match),
//     map(({ payload }) => ({
//       sharedFolderId: payload.id,
//       shareUniqueId: payload.shareUniqueId,
//       prompts: PromptsSelectors.selectPrompts(state$.value),
//       childFolders: PromptsSelectors.selectChildAndCurrentFoldersIdsById(
//         state$.value,
//         payload.id,
//       ),
//       folders: PromptsSelectors.selectFolders(state$.value),
//     })),
//     switchMap(
//       ({ sharedFolderId, shareUniqueId, prompts, childFolders, folders }) => {
//         const mapping = new Map();
//         childFolders.forEach((folderId) => mapping.set(folderId, uuidv4()));
//         const newFolders = folders
//           .filter(({ id }) => childFolders.has(id))
//           .map(({ folderId, ...folder }) => ({
//             ...folder,
//             ...resetShareEntity,
//             id: mapping.get(folder.id),
//             originalId: folder.id,
//             folderId:
//               folder.id === sharedFolderId ? undefined : mapping.get(folderId), // show shared folder on root level
//             sharedWithMe: folder.id === sharedFolderId || folder.sharedWithMe,
//             shareUniqueId:
//               folder.id === sharedFolderId ? shareUniqueId : undefined,
//           }));

//         const sharedPrompts = prompts
//           .filter(
//             (prompt) => prompt.folderId && childFolders.has(prompt.folderId),
//           )
//           .map(({ folderId, ...prompt }) =>
//             addGeneratedPromptId({
//               ...prompt,
//               ...resetShareEntity,
//               originalId: prompt.id,
//               folderId: mapping.get(folderId),
//             }),
//           );

//         return concat(
//           of(
//             PromptsActions.addPrompts({
//               prompts: sharedPrompts,
//             }),
//           ),
//           of(
//             PromptsActions.addFolders({
//               folders: newFolders,
//             }),
//           ),
//         );
//       },
//     ),
//   );

// //TODO: added for development purpose - emulate immediate sharing with yourself
// const sharePromptEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(PromptsActions.sharePrompt.match),
//     map(({ payload }) => ({
//       sharedPromptId: payload.id,
//       shareUniqueId: payload.shareUniqueId,
//       prompts: PromptsSelectors.selectPrompts(state$.value),
//     })),
//     switchMap(({ sharedPromptId, shareUniqueId, prompts }) => {
//       const sharedPrompts = prompts
//         .filter((prompt) => prompt.id === sharedPromptId)
//         .map(({ folderId: _, ...prompt }) =>
//           addGeneratedPromptId({
//             ...prompt,
//             ...resetShareEntity,
//             originalId: prompt.id,
//             folderId: undefined, // show on root level
//             sharedWithMe: true,
//             shareUniqueId:
//               prompt.id === sharedPromptId ? shareUniqueId : undefined,
//           }),
//         );

//       return concat(
//         of(
//           PromptsActions.addPrompts({
//             prompts: sharedPrompts,
//           }),
//         ),
//       );
//     }),
//   );

//TODO: added for development purpose - emulate immediate sharing with yourself
const publishFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.publishFolder.match),
    map(({ payload }) => ({
      publishRequest: payload,
      prompts: PromptsSelectors.selectPrompts(state$.value),
      childFolders: PromptsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.id,
      ),
      folders: PromptsSelectors.selectFolders(state$.value),
      publishedAndTemporaryFolders:
        PromptsSelectors.selectTemporaryAndFilteredFolders(state$.value),
    })),
    switchMap(
      ({
        publishRequest,
        prompts,
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
            publishedWithMe: true,
            name:
              folder.id === publishRequest.id
                ? publishRequest.name
                : folder.name,
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

        const sharedPrompts = prompts
          .filter(
            (prompt) => prompt.folderId && childFolders.has(prompt.folderId),
          )
          .map(({ folderId, ...prompt }) =>
            addGeneratedPromptId({
              ...prompt,
              ...resetShareEntity,
              originalId: prompt.id,
              folderId: mapping.get(folderId),
            }),
          );

        return concat(
          of(
            PromptsActions.addPrompts({
              prompts: sharedPrompts,
            }),
          ),
          of(
            PromptsActions.addFolders({
              folders: [...temporaryFolders, ...newFolders],
            }),
          ),
          of(PromptsActions.deleteAllTemporaryFolders()),
        );
      },
    ),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const publishPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.publishPrompt.match),
    map(({ payload }) => ({
      publishRequest: payload,
      prompts: PromptsSelectors.selectPrompts(state$.value),
      publishedAndTemporaryFolders:
        PromptsSelectors.selectTemporaryAndFilteredFolders(state$.value),
    })),
    switchMap(({ publishRequest, prompts, publishedAndTemporaryFolders }) => {
      const sharedPrompts = prompts
        .filter((prompt) => prompt.id === publishRequest.id)
        .map(({ folderId: _, ...prompt }) =>
          addGeneratedPromptId({
            ...prompt,
            ...resetShareEntity,
            originalId: prompt.id,
            folderId: getFolderIdByPath(
              publishRequest.path,
              publishedAndTemporaryFolders,
            ),
            publishedWithMe: true,
            name: publishRequest.name,
            publishVersion: publishRequest.version,
          }),
        );

      const rootItem = findRootFromItems(sharedPrompts);
      const temporaryFolders = getTemporaryFoldersToPublish(
        publishedAndTemporaryFolders,
        rootItem?.folderId,
        publishRequest.version,
      );

      return concat(
        of(PromptsActions.addFolders({ folders: temporaryFolders })),
        of(PromptsActions.deleteAllTemporaryFolders()),
        of(
          PromptsActions.addPrompts({
            prompts: sharedPrompts,
          }),
        ),
      );
    }),
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

export const PromptsEpics = combineEpics(
  migratePromptsEpic,
  skipFailedMigratedPromptsEpic,
  // init
  initEpic,
  initPromptsEpic,
  // initFoldersEpic,
  savePromptsEpic,
  saveFoldersEpic,
  deleteFolderEpic,
  exportPromptsEpic,
  exportPromptEpic,
  importPromptsEpic,
  updatePromptEpic,
  deletePromptEpic,
  clearPromptsEpic,
  deletePromptsEpic,
  updateFolderEpic,

  // shareFolderEpic,
  // sharePromptEpic,
  publishFolderEpic,
  publishPromptEpic,

  uploadPromptEpic,
);
