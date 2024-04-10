import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  filter,
  forkJoin,
  ignoreElements,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  zip,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import {
  combineEntities,
  filterOnlyMyEntities,
  isImportEntityNameOnSameLevelUnique,
  updateEntitiesFoldersAndIds,
} from '@/src/utils/app/common';
import {
  PromptService,
  getImportPreparedPrompts,
} from '@/src/utils/app/data/prompt-service';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  generateNextName,
  getFolderFromId,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
  splitEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import {
  exportPrompt,
  exportPrompts,
  isPromptsFormat,
} from '@/src/utils/app/import-export';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';
import { getPromptApiKey } from '@/src/utils/server/api';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-ui-settings';
import { errorsMessages } from '@/src/constants/errors';

import { ImportExportActions } from '../import-export/importExport.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { RootState } from '@/src/store';
import uniq from 'lodash-es/uniq';

const createNewPromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.createNewPrompt.match),
    switchMap(({ payload: newPrompt }) => {
      return PromptService.createPrompt(newPrompt).pipe(
        switchMap((apiPrompt) => {
          return concat(
            iif(
              // check if something renamed
              () => apiPrompt?.name !== newPrompt.name,
              of(PromptsActions.uploadPromptsWithFoldersRecursive()),
              of(
                PromptsActions.createNewPromptSuccess({
                  newPrompt,
                }),
              ),
            ),
            of(PromptsActions.setIsNewPromptCreating(false)),
          );
        }),
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
            of(PromptsActions.setIsNewPromptCreating(false)),
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
    const prompt = regeneratePromptId({
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
    concatMap(({ payload: newPrompt }) =>
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
          folderId: parentPath || getPromptRootId(),
          name: payload.old.name,
        }),
      ).pipe(
        switchMap(() => EMPTY),
        catchError((err) => {
          console.error(err);
          return concat(
            of(
              PromptsActions.recreatePromptFail({
                newId: payload.new.id,
                oldPrompt: payload.old,
              }),
            ),
            of(
              UIActions.showErrorToast(
                translate(
                  'An error occurred while saving the prompt. Please refresh the page.',
                ),
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
                `An error occurred while deleting the prompt "${payload.prompt.name}"`,
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
        of(PromptsActions.clearPromptsSuccess()),
        of(PromptsActions.deleteFolder({})),
      ),
    ),
  );

const deletePromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.deletePrompts.match),
    map(({ payload }) => ({
      deletePrompts: payload.promptsToDelete,
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
                    `An error occurred while deleting the prompt(s): "${failedNames.filter(Boolean).join('", "')}"`,
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
              regeneratePromptId({
                ...prompt,
                folderId: updateFolderId(prompt.folderId),
              }),
            ),
            prompts.map((prompt) =>
              regeneratePromptId({
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
        promptsToDelete: PromptService.getPrompts(payload.folderId, true).pipe(
          catchError((err) => {
            console.error(
              'An error occurred while uploading prompts and folders:',
              err,
            );
            return of([]);
          }),
        ),
        folders: of(PromptsSelectors.selectFolders(state$.value)),
      }),
    ),
    switchMap(({ folderId, promptsToDelete, folders }) => {
      const actions: Observable<AnyAction>[] = [];

      if (promptsToDelete.length) {
        actions.push(
          of(
            PromptsActions.deletePrompts({
              promptsToDelete: promptsToDelete,
            }),
          ),
        );
      }

      return concat(
        of(
          PromptsActions.setFolders({
            folders: folders.filter(
              (folder) =>
                folder.id !== folderId && !folder.id.startsWith(`${folderId}/`),
            ),
          }),
        ),
        ...actions,
      );
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
            ids: [payload.id],
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
      const promptFolderId = isEntityOrParentsExternal(
        state$.value,
        prompt,
        FeatureType.Prompt,
      )
        ? getPromptRootId()
        : prompt.folderId;

      const newPrompt = regeneratePromptId({
        ...prompt,
        ...resetShareEntity,
        folderId: promptFolderId,
        name: generateNextName(
          DEFAULT_PROMPT_NAME,
          prompt.name,
          prompts.filter((prompt) => prompt.folderId === promptFolderId), // only root prompts for external entities
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
      PromptService.getPrompts(undefined, true),
    ),
    switchMap((promptsListing) => {
      const onlyMyPromptsListing = filterOnlyMyEntities(promptsListing);
      const foldersIds = uniq(
        onlyMyPromptsListing.map((info) => info.folderId),
      );
      //calculate all folders;
      const foldersWithPrompts = getFoldersFromIds(
        uniq(foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id))),
        FolderType.Prompt,
      );

      const allFolders = PromptsSelectors.selectFolders(state$.value);

      const folders = combineEntities(foldersWithPrompts, allFolders);

      return forkJoin({
        //get all prompts from api
        prompts: zip(
          onlyMyPromptsListing.map((info) => PromptService.getPrompt(info)),
        ),
        folders: of(folders),
      });
    }),
    switchMap(({ prompts, folders }) => {
      const filteredPrompts = prompts.filter(Boolean) as Prompt[];

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportPrompts(filteredPrompts, folders, appName);
      return EMPTY;
    }),
    catchError(() =>
      concat(
        of(
          UIActions.showErrorToast(
            translate('An error occurred while uploading prompts'),
          ),
        ),
        of(ImportExportActions.exportFail()),
      ),
    ),
  );

const exportPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.exportPrompt.match),
    switchMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),

    switchMap((promptAndPayload) => {
      const { prompt } = promptAndPayload;
      if (!prompt) {
        return concat(
          of(
            UIActions.showErrorToast(
              translate('An error occurred while uploading prompt'),
            ),
          ),
          of(ImportExportActions.exportFail()),
        );
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

      if (!preparedPrompts.length) {
        return of(ImportExportActions.importPromptsFail());
      }

      return PromptService.getPrompts(undefined, true).pipe(
        switchMap((promptsListing) => {
          const existedImportNamesPrompts = preparedPrompts.filter(
            (importPrompt) =>
              !isImportEntityNameOnSameLevelUnique({
                entity: importPrompt,
                entities: promptsListing,
              }),
          );

          const nonExistedImportNamesPrompts = preparedPrompts.filter(
            (importPrompt) => {
              return isImportEntityNameOnSameLevelUnique({
                entity: importPrompt,
                entities: promptsListing,
              });
            },
          );

          if (!existedImportNamesPrompts.length) {
            return of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: nonExistedImportNamesPrompts,
                folders: promptsHistory.folders,
              }),
            );
          }

          if (!nonExistedImportNamesPrompts.length) {
            return of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesPrompts,
                featureType: FeatureType.Prompt,
              }),
            );
          }

          return concat(
            of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesPrompts,
                featureType: FeatureType.Prompt,
              }),
            ),
            of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: nonExistedImportNamesPrompts,
                folders: promptsHistory.folders,
              }),
            ),
          );
        }),
        catchError(() => of(ImportExportActions.importPromptsFail())),
      );
    }),
  );

const uploadPromptsWithFoldersRecursiveEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.uploadPromptsWithFoldersRecursive.match),
    mergeMap(({ payload }) =>
      PromptService.getPrompts(payload?.path, true).pipe(
        mergeMap((prompts) => {
          const actions: Observable<AnyAction>[] = [];
          const folderIds = uniq(prompts.map((c) => c.folderId));
          const paths = uniq(
            folderIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
          );

          if (!!payload?.selectFirst && !!prompts.length && !!payload?.path) {
            const openedFolders = UISelectors.selectOpenedFoldersIds(
              state$.value,
              FeatureType.Prompt,
            );

            actions.push(
              concat(
                of(
                  PromptsActions.uploadChildPromptsWithFoldersSuccess({
                    parentIds: [...payload.path, ...paths],
                    folders: getFoldersFromIds(
                      paths,
                      FolderType.Prompt,
                      UploadStatus.LOADED,
                    ),
                    prompts,
                  }),
                ),
                of(PromptsActions.uploadPrompt({ promptId: prompts[0]?.id })),
                of(
                  PromptsActions.setSelectedPrompt({
                    promptId: prompts[0]?.id,
                  }),
                ),
                of(
                  UIActions.setOpenedFoldersIds({
                    featureType: FeatureType.Prompt,
                    openedFolderIds: [
                      ...uniq(
                        prompts.flatMap((p) =>
                          getParentFolderIdsFromFolderId(p.folderId),
                        ),
                      ),
                      ...openedFolders,
                    ],
                  }),
                ),
              ),
            );
          }

          return concat(
            of(
              PromptsActions.addPrompts({
                prompts,
              }),
            ),
            of(
              PromptsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FolderType.Prompt),
                  status: UploadStatus.LOADED,
                })),
              }),
            ),
            of(PromptsActions.initFoldersAndPromptsSuccess()),
            ...actions,
          );
        }),
        catchError((err) => {
          console.error(
            'An error occurred while uploading prompts and folders:',
            err,
          );
          return [];
        }),
      ),
    ),
  );

const uploadPromptsWithFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.uploadChildPromptsWithFolders.match),
    switchMap(({ payload }) =>
      zip(
        payload.ids.map((path) => PromptService.getPromptsAndFolders(path)),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const folders = foldersAndEntities.flatMap((f) => f.folders);
          const prompts = foldersAndEntities.flatMap((f) => f.entities);

          return of(
            PromptsActions.uploadChildPromptsWithFoldersSuccess({
              parentIds: payload.ids,
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
      );

      return PromptService.getPrompt(
        originalPrompt || ({ id: payload.promptId } as PromptInfo),
      );
    }),
    map((servicePrompt) => {
      return PromptsActions.uploadPromptSuccess({
        prompt: servicePrompt,
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
);
