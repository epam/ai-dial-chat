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
  updateEntitiesFoldersAndIds,
} from '@/src/utils/app/common';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { getOrUploadPrompt } from '@/src/utils/app/data/storages/api/prompt-api-storage';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  generateNextName,
  getFolderFromId,
  getParentFolderIdsFromFolderId,
  splitEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';
import { getPromptRootId, isEntityIdExternal } from '@/src/utils/app/id';
import {
  getPromptInfoFromId,
  regeneratePromptId,
} from '@/src/utils/app/prompts';
import { mapPublishedItems } from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';
import { getPromptApiKey } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { AppEpic } from '@/src/types/store';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-ui-settings';

import { PublicationActions } from '../publication/publication.reducers';
import { ShareActions } from '../share/share.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { UploadStatus } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$) =>
  action$.pipe(
    filter((action) => PromptsActions.init.match(action)),
    switchMap(() =>
      PromptService.getPrompts(undefined, true).pipe(
        mergeMap((prompts) => {
          const paths = uniq(
            prompts.flatMap((p) => getParentFolderIdsFromFolderId(p.folderId)),
          );

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
            of(
              PublicationActions.uploadAllPublishedWithMeItems({
                featureType: FeatureType.Prompt,
              }),
            ),
          );
        }),
      ),
    ),
  );

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
              concat(
                of(PromptsActions.uploadPromptsWithFoldersRecursive()),
                of(ShareActions.triggerGettingSharedPromptListings()),
              ),
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

const savePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.savePrompt.match),
    concatMap(({ payload: newPrompt }) =>
      PromptService.updatePrompt(newPrompt),
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
    ignoreElements(),
  );

const recreatePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(PromptsActions.recreatePrompt.match),
    mergeMap(({ payload }) => {
      const { parentPath } = splitEntityId(payload.old.id);
      return PromptService.createPrompt(payload.new).pipe(
        switchMap(() =>
          PromptService.deletePrompt({
            id: payload.old.id,
            folderId: parentPath || getPromptRootId(),
            name: payload.old.name,
          }),
        ),
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
        ignoreElements(),
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
      promptIds: new Set(payload.promptIds),
    })),
    switchMap(({ promptIds }) =>
      zip(
        Array.from(promptIds).map((id) =>
          PromptService.deletePrompt(getPromptInfoFromId(id)).pipe(
            map(() => null),
            catchError((err) => {
              const { name } = getPromptInfoFromId(id);

              console.error(
                `An error occurred while deleting the prompt "${name}"`,
                err,
              );
              return of(name);
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
            of(PromptsActions.deletePromptsComplete({ promptIds })),
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
      const promptIds = promptsToDelete.map((p) => p.id);

      if (promptIds.length) {
        actions.push(of(PromptsActions.deletePrompts({ promptIds })));
      } else {
        actions.push(
          of(PromptsActions.deletePromptsComplete({ promptIds: new Set([]) })),
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

const openFolderEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        UIActions.openFolder.match(action) &&
        action.payload.featureType === FeatureType.Prompt,
    ),
    switchMap(({ payload }) =>
      of(PromptsActions.uploadFoldersIfNotLoaded({ ids: [payload.id] })),
    ),
  );

const duplicatePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.duplicatePrompt.match),
    switchMap(({ payload }) =>
      forkJoin({
        prompt: getOrUploadPrompt(payload, state$.value).pipe(
          map((data) => data.prompt),
        ),
      }),
    ),
    switchMap(({ prompt }) => {
      if (!prompt) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this prompt has been deleted. Please reload the page',
            ),
          ),
        );
      }

      const prompts = PromptsSelectors.selectPrompts(state$.value);
      const promptFolderId = isEntityIdExternal(prompt)
        ? getPromptRootId() // duplicate external entities in the root only
        : prompt.folderId;

      const newPrompt = regeneratePromptId({
        ...omit(prompt, ['publicationInfo']),
        ...resetShareEntity,
        folderId: promptFolderId,
        name: generateNextName(
          DEFAULT_PROMPT_NAME,
          prompt.name,
          prompts.filter((p) => p.folderId === promptFolderId), // only root prompts for external entities
        ),
      });

      return of(PromptsActions.saveNewPrompt({ newPrompt }));
    }),
  );

const uploadPromptsFromMultipleFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.uploadPromptsFromMultipleFolders.match),
    mergeMap(({ payload }) => {
      return PromptService.getMultipleFoldersPrompts(
        payload.paths,
        payload.recursive,
      ).pipe(
        switchMap((prompts) => {
          const actions: Observable<AnyAction>[] = [];
          const paths = uniq(
            prompts.flatMap((prompt) =>
              getParentFolderIdsFromFolderId(prompt.folderId),
            ),
          );

          if (!!payload?.pathToSelectFrom && !!prompts.length) {
            const openedFolders = UISelectors.selectOpenedFoldersIds(
              state$.value,
              FeatureType.Prompt,
            );
            const topLevelPrompt = prompts
              .filter((prompt) =>
                prompt.id.startsWith(`${payload.pathToSelectFrom}/`),
              )
              .toSorted((a, b) => a.folderId.length - b.folderId.length)[0];

            actions.push(
              concat(
                of(
                  PromptsActions.setIsEditModalOpen({
                    isOpen: true,
                    isPreview: true,
                  }),
                ),
                of(
                  PromptsActions.uploadPrompt({ promptId: topLevelPrompt.id }),
                ),
                of(
                  PromptsActions.setSelectedPrompt({
                    promptId: topLevelPrompt.id,
                  }),
                ),
                of(
                  UIActions.setOpenedFoldersIds({
                    featureType: FeatureType.Prompt,
                    openedFolderIds: [
                      ...openedFolders,
                      ...paths.filter(
                        (path) =>
                          path === payload.pathToSelectFrom ||
                          path.startsWith(`${payload.pathToSelectFrom}/`),
                      ),
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
            ...actions,
          );
        }),
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
          const paths = uniq(
            prompts.flatMap((p) => getParentFolderIdsFromFolderId(p.folderId)),
          );

          const publicPromptIds = prompts
            .filter((conv) => {
              const rootParentFolder = PromptsSelectors.selectRootParentFolder(
                state$.value,
                conv.folderId,
              );

              return rootParentFolder && rootParentFolder.publishedWithMe;
            })
            .map((conv) => conv.id);
          const { publicVersionGroups, items: publicPrompts } =
            mapPublishedItems<PromptInfo>(publicPromptIds, FeatureType.Prompt);
          const notPublicPrompts = prompts.filter(
            (conv) => !publicPromptIds.includes(conv.id),
          );

          if (publicPromptIds.length) {
            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          return concat(
            of(
              PromptsActions.addPrompts({
                prompts: [...publicPrompts, ...notPublicPrompts],
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
            of(PromptsActions.uploadPromptsWithFoldersRecursiveSuccess()),
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

const uploadFolderIfNotLoadedEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.uploadFoldersIfNotLoaded.match),
    mergeMap(({ payload }) => {
      const folders = PromptsSelectors.selectFolders(state$.value);
      const notUploadedPaths = folders
        .filter(
          (folder) =>
            payload.ids.includes(folder.id) &&
            folder.status !== UploadStatus.LOADED,
        )
        .map((folder) => folder.id);

      if (!notUploadedPaths.length) {
        return EMPTY;
      }

      return of(PromptsActions.uploadFolders({ ids: notUploadedPaths }));
    }),
  );

const uploadFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.uploadFolders.match),
    mergeMap(({ payload }) =>
      zip(
        payload.ids.map((path) => PromptService.getPromptsAndFolders(path)),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const actions: Observable<AnyAction>[] = [];
          const folders = foldersAndEntities.flatMap((f) => f.folders);
          const prompts = foldersAndEntities.flatMap((f) => f.entities);

          const publicPromptIds = prompts
            .filter((prompt) => {
              const rootParentFolder = PromptsSelectors.selectRootParentFolder(
                state$.value,
                prompt.folderId,
              );

              return rootParentFolder && rootParentFolder.publishedWithMe;
            })
            .map((prompt) => prompt.id);
          const { publicVersionGroups, items: publicPrompts } =
            mapPublishedItems<PromptInfo>(publicPromptIds, FeatureType.Prompt);
          const notPublicPrompts = prompts.filter(
            (conv) => !publicPromptIds.includes(conv.id),
          );

          if (publicPromptIds.length) {
            actions.push(
              of(
                PublicationActions.addPublicVersionGroups({
                  publicVersionGroups,
                }),
              ),
            );
          }

          return concat(
            ...actions,
            of(
              PromptsActions.uploadChildPromptsWithFoldersSuccess({
                parentIds: payload.ids,
                folders,
                prompts: [...publicPrompts, ...notPublicPrompts],
              }),
            ),
            ...payload.ids.map((id) =>
              of(
                PromptsActions.updateFolder({
                  folderId: id,
                  values: { status: UploadStatus.LOADED },
                }),
              ),
            ),
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

const deleteChosenPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) => PromptsActions.deleteChosenPrompts.match(action)),
    switchMap(() => {
      const actions: Observable<AnyAction>[] = [];
      const prompts = PromptsSelectors.selectPrompts(state$.value);
      const chosenPromptIds = PromptsSelectors.selectSelectedItems(
        state$.value,
      );
      const { fullyChosenFolderIds } = PromptsSelectors.selectChosenFolderIds(
        state$.value,
        prompts,
      );
      const promptIds = PromptsSelectors.selectPrompts(state$.value).map(
        (prompt) => prompt.id,
      );
      const folders = PromptsSelectors.selectFolders(state$.value);
      const emptyFoldersIds = PromptsSelectors.selectEmptyFolderIds(
        state$.value,
      );
      const deletedPromptIds = uniq([
        ...chosenPromptIds,
        ...promptIds.filter((id) =>
          fullyChosenFolderIds.some((folderId) => id.startsWith(folderId)),
        ),
      ]);

      if (promptIds.length) {
        actions.push(
          of(
            PromptsActions.deletePrompts({
              promptIds: deletedPromptIds,
            }),
          ),
        );
      }

      return concat(
        of(
          PromptsActions.setFolders({
            folders: folders.filter(
              (folder) =>
                !fullyChosenFolderIds.includes(`${folder.id}/`) &&
                (prompts.some((p) => p.id.startsWith(`${folder.id}/`)) ||
                  emptyFoldersIds.some((id) => id === folder.id)),
            ),
          }),
        ),
        of(PromptsActions.resetChosenPrompts()),
        ...actions,
      );
    }),
  );

export const PromptsEpics = combineEpics(
  initEpic,
  uploadPromptsFromMultipleFoldersEpic,
  uploadPromptsWithFoldersRecursiveEpic,
  uploadFolderIfNotLoadedEpic,
  uploadFoldersEpic,
  openFolderEpic,
  toggleFolderEpic,
  saveFoldersEpic,
  saveNewPromptEpic,
  deleteFolderEpic,
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
  deleteChosenPromptsEpic,
);
