import { concat, filter, ignoreElements, map, of, switchMap, tap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import {
  findRootFromItems,
  getFolderIdByPath,
  getTemporaryFoldersToPublish,
} from '@/src/utils/app/folders';
import {
  exportPrompt,
  exportPrompts,
  importPrompts,
} from '@/src/utils/app/import-export';
import { PublishedWithMeFilter } from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';

import { resetShareEntity } from '@/src/constants/chat';
import { errorsMessages } from '@/src/constants/errors';

import { UIActions } from '../ui/ui.reducers';
import { PromptsActions, PromptsSelectors } from './prompts.reducers';

import { v4 as uuidv4 } from 'uuid';

const savePromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        PromptsActions.createNewPrompt.match(action) ||
        PromptsActions.deletePrompts.match(action) ||
        PromptsActions.clearPrompts.match(action) ||
        PromptsActions.updatePrompt.match(action) ||
        PromptsActions.addPrompts.match(action) ||
        PromptsActions.importPromptsSuccess.match(action) ||
        PromptsActions.unpublishPrompt.match(action) ||
        PromptsActions.duplicatePrompt.match(action),
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
          (prompt) => prompt.folderId && childFolders.has(prompt.folderId),
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
            folders: folders.filter((folder) => !childFolders.has(folder.id)),
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

//TODO: added for development purpose - emulate immediate sharing with yourself
const shareFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.shareFolder.match),
    map(({ payload }) => ({
      sharedFolderId: payload.id,
      shareUniqueId: payload.shareUniqueId,
      prompts: PromptsSelectors.selectPrompts(state$.value),
      childFolders: PromptsSelectors.selectChildAndCurrentFoldersIdsById(
        state$.value,
        payload.id,
      ),
      folders: PromptsSelectors.selectFolders(state$.value),
    })),
    switchMap(
      ({ sharedFolderId, shareUniqueId, prompts, childFolders, folders }) => {
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
              folder.id === sharedFolderId ? undefined : mapping.get(folderId), // show shared folder on root level
            sharedWithMe: folder.id === sharedFolderId || folder.sharedWithMe,
            shareUniqueId:
              folder.id === sharedFolderId ? shareUniqueId : undefined,
          }));

        const sharedPrompts = prompts
          .filter(
            (prompt) => prompt.folderId && childFolders.has(prompt.folderId),
          )
          .map(({ folderId, ...prompt }) => ({
            ...prompt,
            ...resetShareEntity,
            id: uuidv4(),
            originalId: prompt.id,
            folderId: mapping.get(folderId),
          }));

        return concat(
          of(
            PromptsActions.addPrompts({
              prompts: sharedPrompts,
            }),
          ),
          of(
            PromptsActions.addFolders({
              folders: newFolders,
            }),
          ),
        );
      },
    ),
  );

//TODO: added for development purpose - emulate immediate sharing with yourself
const sharePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(PromptsActions.sharePrompt.match),
    map(({ payload }) => ({
      sharedPromptId: payload.id,
      shareUniqueId: payload.shareUniqueId,
      prompts: PromptsSelectors.selectPrompts(state$.value),
    })),
    switchMap(({ sharedPromptId, shareUniqueId, prompts }) => {
      const sharedPrompts = prompts
        .filter((prompt) => prompt.id === sharedPromptId)
        .map(({ folderId: _, ...prompt }) => ({
          ...prompt,
          ...resetShareEntity,
          id: uuidv4(),
          originalId: prompt.id,
          folderId: undefined, // show on root level
          sharedWithMe: true,
          shareUniqueId:
            prompt.id === sharedPromptId ? shareUniqueId : undefined,
        }));

      return concat(
        of(
          PromptsActions.addPrompts({
            prompts: sharedPrompts,
          }),
        ),
      );
    }),
  );

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
            shareUniqueId:
              folder.id === publishRequest.id
                ? publishRequest.shareUniqueId
                : folder.shareUniqueId,
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
          .map(({ folderId, ...prompt }) => ({
            ...prompt,
            ...resetShareEntity,
            id: uuidv4(),
            originalId: prompt.id,
            folderId: mapping.get(folderId),
          }));

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
        .map(({ folderId: _, ...prompt }) => ({
          ...prompt,
          ...resetShareEntity,
          id: uuidv4(),
          originalId: prompt.id,
          folderId: getFolderIdByPath(
            publishRequest.path,
            publishedAndTemporaryFolders,
          ),
          publishedWithMe: true,
          name: publishRequest.name,
          publishVersion: publishRequest.version,
          shareUniqueId: publishRequest.shareUniqueId,
        }));

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

  shareFolderEpic,
  sharePromptEpic,
  publishFolderEpic,
  publishPromptEpic,
);
