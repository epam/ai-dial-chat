import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  filter,
  ignoreElements,
  iif,
  map,
  mergeMap,
  of,
  switchMap,
  zip,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { getDefaultEntityProps } from '@/src/utils/app/common';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import { getOrUploadPrompt } from '@/src/utils/app/data/storages/api/prompt-api-storage';
import {
  addGeneratedFolderId,
  generateNextName,
  getFolderFromId,
  getParentFolderIdsFromFolderId,
  updateChildAndCurrentFoldersIds,
  updateChildFoldersIds,
} from '@/src/utils/app/folders';
import { getPromptRootId, isEntityIdExternal } from '@/src/utils/app/id';
import { isTabletScreen } from '@/src/utils/app/mobile';
import {
  getPromptInfoFromId,
  parseVariablesFromContent,
  regeneratePromptId,
} from '@/src/utils/app/prompts';
import {
  getVersionGroupFromId,
  isEntityIdPublic,
  mapPublishedItems,
} from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';

import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { AppAction, AppEpic } from '@/src/types/store';

import {
  ChatActions,
  PromptsActions,
  PublicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { PromptsSelectors, UISelectors } from '@/src/store/selectors';

import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-ui-settings';
import { RECENT_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { UploadStatus } from '@epam/ai-dial-shared';
import omit from 'lodash-es/omit';
import uniq from 'lodash-es/uniq';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.init.type),
    filter(() => !PromptsSelectors.selectInitialized(state$.value)),
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
                  ...getFolderFromId(path, FeatureType.Prompt),
                  status: UploadStatus.LOADED,
                })),
              }),
            ),
            of(PromptsActions.initFoldersAndPromptsSuccess()),
            of(PromptsActions.initFinish()),
          );
        }),
      ),
    ),
  );

const createNewPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.createNewPrompt.type),
    switchMap(({ payload: newPrompt }) => {
      return PromptService.createPrompt(newPrompt).pipe(
        switchMap((apiPrompt) => {
          const collapsedSections = UISelectors.selectCollapsedSections(
            FeatureType.Prompt,
          )(state$.value);

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
            of(
              UIActions.setCollapsedSections({
                featureType: FeatureType.Prompt,
                collapsedSections: collapsedSections.filter(
                  (section) => section !== RECENT_PROMPTS_SECTION_NAME,
                ),
              }),
            ),
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
    ofType(PromptsActions.saveNewPrompt.type),
    mergeMap(({ payload }) =>
      concat(
        of(PromptsActions.createNewPromptSuccess(payload)),
        PromptService.createPrompt(payload.newPrompt).pipe(
          switchMap(() => EMPTY),
          catchError((err) => {
            console.error(err);
            return concat(
              of(
                UIActions.showErrorToast(
                  translate(
                    'An error occurred while saving the prompt. Most likely the prompt already exists. Please refresh the page.',
                  ),
                ),
              ),
              of(
                PromptsActions.deletePromptsComplete({
                  promptIds: new Set(payload.newPrompt.id),
                }),
              ),
            );
          }),
        ),
      ),
    ),
  );

const saveFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      PromptsActions.createFolder.type,
      PromptsActions.deleteFolder.type,
      PromptsActions.addFolders.type,
      PromptsActions.clearPrompts.type,
      PromptsActions.importPromptsSuccess.type,
      PromptsActions.setFolders.type,
    ),
    map(() => PromptsSelectors.selectFolders(state$.value)),
    switchMap((promptsFolders) => {
      return PromptService.setPromptFolders(promptsFolders).pipe(
        catchError((err) => {
          const message = 'An error occurred during the saving folders';
          console.error(message, err);
          return of(UIActions.showErrorToast(translate(message)));
        }),
      );
    }),
    ignoreElements(),
  );

const savePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.savePrompt.type),
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

const movePromptFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.movePromptFail.type),
    switchMap(() => {
      return of(
        UIActions.showErrorToast(
          translate(
            'It looks like prompt already exist. Please reload the page',
          ),
        ),
      );
    }),
  );

const movePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.movePrompt.type),
    mergeMap(({ payload }) => {
      return PromptService.movePrompt({
        sourceUrl: payload.oldPrompt.id,
        destinationUrl: payload.newPrompt.id,
        overwrite: false,
      }).pipe(
        switchMap(() => {
          return of(PromptsActions.savePrompt(payload.newPrompt));
        }),
        catchError(() => {
          return of(PromptsActions.movePromptFail(payload));
        }),
      );
    }),
  );

const updatePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.updatePrompt.type),
    mergeMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),
    mergeMap(({ payload, prompt }) => {
      if (!prompt) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this prompt has been deleted. Please reload the page',
            ),
          ),
        );
      }

      const { values, id, publicationUrl } = payload;
      const newPrompt = regeneratePromptId({
        ...prompt,
        ...values,
        updatedAt: Date.now(),
      });

      const areIdsEqual = prompt.id === newPrompt.id;
      if (!areIdsEqual && publicationUrl) {
        return of(
          PublicationActions.updatePublicationRequestAndEntity({
            resourceToUpdateUrl: id,
            newEntity: newPrompt,
            publicationUrl,
          }),
        );
      }

      return concat(
        of(PromptsActions.updatePromptSuccess({ prompt: newPrompt, id })),
        iif(
          () => !areIdsEqual,
          of(PromptsActions.movePrompt({ oldPrompt: prompt, newPrompt })),
          of(PromptsActions.savePrompt(newPrompt)),
        ),
      );
    }),
  );

export const deletePromptEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.deletePrompt.type),
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
    ofType(PromptsActions.clearPrompts.type),
    switchMap(() =>
      concat(
        of(PromptsActions.deleteFolder({ folderId: getPromptRootId() })),
        of(PromptsActions.clearPromptsSuccess()),
      ),
    ),
  );

const deletePromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.deletePrompts.type),
    switchMap(({ payload }) =>
      zip(
        payload.promptIds.map((id) =>
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
            of(
              PromptsActions.deletePromptsComplete({
                promptIds: new Set(payload.promptIds),
              }),
            ),
          ),
        ),
      ),
    ),
  );

const updateFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.updateFolder.type),
    switchMap(({ payload }) => {
      const state = state$.value;
      const folder = PromptsSelectors.selectFolderById(state, payload.folderId);

      if (!folder) {
        return EMPTY;
      }

      const newFolder = addGeneratedFolderId({ ...folder, ...payload.values });

      if (payload.folderId === newFolder.id) {
        return of(
          PromptsActions.updateFoldersSuccess({
            folders: [{ oldId: payload.folderId, newFolder }],
          }),
        );
      }

      if (payload.publicationUrl) {
        return of(
          PublicationActions.updatePublicationRequestAndFolder({
            folderIdToUpdate: payload.folderId,
            newFolder,
            publicationUrl: payload.publicationUrl,
          }),
        );
      }

      const openedFolderIds = UISelectors.selectOpenedFoldersIds(
        FeatureType.Prompt,
      )(state);
      const updatedOpenedFolderIds = updateChildAndCurrentFoldersIds(
        openedFolderIds,
        payload.folderId,
        newFolder.id,
      );

      const folders = PromptsSelectors.selectFoldersByFolderId(
        state,
        payload.folderId,
      );
      const updatedFolders = [
        ...updateChildFoldersIds(folders, payload.folderId, newFolder.id),
        { oldId: payload.folderId, newFolder },
      ];

      const prompts = PromptsSelectors.selectPromptsByFolderId(
        state,
        payload.folderId,
      );

      return concat(
        ...prompts.map((prompt) => {
          return of(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: {
                folderId: prompt.folderId.replace(
                  payload.folderId,
                  newFolder.id,
                ),
              },
            }),
          );
        }),
        of(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: updatedOpenedFolderIds,
            featureType: FeatureType.Prompt,
          }),
        ),
        of(
          PromptsActions.updateFoldersSuccess({
            folders: updatedFolders,
          }),
        ),
      );
    }),
  );

const deleteFolderEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.deleteFolder.type),
    switchMap(({ payload: { folderId } }) => {
      const actions: Observable<AppAction>[] = [];
      const state = state$.value;

      const promptIds = PromptsSelectors.selectPromptsByFolderId(
        state,
        folderId,
      ).map((prompt) => prompt.id);

      if (promptIds.length) {
        actions.push(of(PromptsActions.deletePrompts({ promptIds })));
      } else
        actions.push(
          of(
            PromptsActions.deletePromptsComplete({
              promptIds: new Set([]),
            }),
          ),
        );

      const folders = PromptsSelectors.selectFolders(state);

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
    ofType(PromptsActions.toggleFolder.type),
    switchMap(({ payload }) => {
      const openedFoldersIds = UISelectors.selectOpenedFoldersIds(
        FeatureType.Prompt,
      )(state$.value);
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
    ofType(UIActions.openFolder.type),
    filter(({ payload }) => payload.featureType === FeatureType.Prompt),
    switchMap(({ payload }) =>
      of(PromptsActions.uploadFoldersIfNotLoaded({ ids: [payload.id] })),
    ),
  );

const duplicatePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.duplicatePrompt.type),
    switchMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),
    switchMap(({ prompt, wasUploaded }) => {
      if (!prompt) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this prompt has been deleted. Please reload the page',
            ),
          ),
        );
      }

      const state = state$.value;

      const prompts = PromptsSelectors.selectPrompts(state);
      const { selectedPromptId } =
        PromptsSelectors.selectSelectedPromptId(state);
      const promptFolderId = isEntityIdExternal(prompt)
        ? getPromptRootId() // duplicate external entities in the root only
        : prompt.folderId;

      const newPrompt = regeneratePromptId({
        ...omit(prompt, ['publicationInfo']),
        ...getDefaultEntityProps(),
        folderId: promptFolderId,
        name: generateNextName(
          DEFAULT_PROMPT_NAME,
          prompt.name,
          prompts.filter((p) => p.folderId === promptFolderId), // only root prompts for external entities
        ),
      });

      return concat(
        of(PromptsActions.saveNewPrompt({ newPrompt })),
        of(UIActions.setScrollToEntityId(newPrompt.id)),
        iif(
          () => selectedPromptId === prompt.id,
          concat(
            of(PromptsActions.setSelectedPrompt({ promptId: newPrompt.id })),
            of(PromptsActions.uploadPromptSuccess({ prompt: null })),
          ),
          EMPTY,
        ),
        iif(
          () => wasUploaded,
          of(PromptsActions.updatePromptSuccess({ id: prompt.id, prompt })),
          EMPTY,
        ),
      );
    }),
  );

const uploadPromptsFromMultipleFoldersEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.uploadPromptsFromMultipleFolders.type),
    mergeMap(({ payload }) => {
      return PromptService.getMultipleFoldersPrompts(
        payload.paths,
        payload.recursive,
      ).pipe(
        switchMap((prompts) => {
          const actions: Observable<AppAction>[] = [];

          const paths = uniq(
            prompts.flatMap((prompt) =>
              getParentFolderIdsFromFolderId(prompt.folderId),
            ),
          );

          if (!!payload?.pathToSelectFrom && !!prompts.length) {
            const openedFolders = UISelectors.selectOpenedFoldersIds(
              FeatureType.Prompt,
            )(state$.value);
            const topLevelPrompt = prompts
              .filter((prompt) =>
                prompt.id.startsWith(`${payload.pathToSelectFrom}/`),
              )
              .toSorted((a, b) => a.folderId.length - b.folderId.length)[0];

            actions.push(
              concat(
                of(
                  PromptsActions.selectPrompt({
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
                  ...getFolderFromId(path, FeatureType.Prompt),
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

const uploadPromptsWithFoldersRecursiveEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.uploadPromptsWithFoldersRecursive.type),
    mergeMap(({ payload }) =>
      PromptService.getPrompts(payload?.path, true).pipe(
        mergeMap((prompts) => {
          const actions: Observable<AppAction>[] = [];

          const paths = uniq(
            prompts.flatMap((prompt) =>
              getParentFolderIdsFromFolderId(prompt.folderId),
            ),
          );
          const publicPrompts = prompts.filter((prompt) =>
            isEntityIdPublic(prompt),
          );
          const publicPromptIds = publicPrompts.map((prompt) => prompt.id);
          const { publicVersionGroups, items: mappedPublicPrompts } =
            mapPublishedItems<PromptInfo>(publicPrompts, FeatureType.Prompt);
          const notPublicPrompts = prompts.filter(
            (prompt) => !publicPromptIds.includes(prompt.id),
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
                prompts: [...mappedPublicPrompts, ...notPublicPrompts],
              }),
            ),
            of(
              PromptsActions.addFolders({
                folders: paths.map((path) => ({
                  ...getFolderFromId(path, FeatureType.Prompt),
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
    ofType(PromptsActions.uploadFoldersIfNotLoaded.type),
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

const uploadFoldersEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.uploadFolders.type),
    mergeMap(({ payload }) =>
      zip(
        payload.ids.map((path) => PromptService.getPromptsAndFolders(path)),
      ).pipe(
        switchMap((foldersAndEntities) => {
          const actions: Observable<AppAction>[] = [];

          const folders = foldersAndEntities.flatMap((items) => items.folders);
          const prompts = foldersAndEntities.flatMap((items) => items.entities);
          const publicPrompts = prompts.filter((prompt) =>
            isEntityIdPublic(prompt),
          );
          const publicPromptIds = prompts.map((prompt) => prompt.id);
          const { publicVersionGroups, items: mappedPublicPrompts } =
            mapPublishedItems<PromptInfo>(publicPrompts, FeatureType.Prompt);
          const notPublicPrompts = prompts.filter(
            (prompt) => !publicPromptIds.includes(prompt.id),
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
                prompts: [...mappedPublicPrompts, ...notPublicPrompts],
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
    ofType(PromptsActions.uploadPrompt.type),
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
    ofType(PromptsActions.deleteChosenPrompts.type),
    switchMap(() => {
      const actions: Observable<AppAction>[] = [];
      const state = state$.value;

      const prompts = PromptsSelectors.selectPrompts(state);
      const chosenPromptIds = PromptsSelectors.selectSelectedItems(state);
      const { fullyChosenFolderIds } =
        PromptsSelectors.selectChosenFolderIds(prompts)(state);
      const promptIds = PromptsSelectors.selectPrompts(state).map(
        (prompt) => prompt.id,
      );
      const folders = PromptsSelectors.selectFolders(state);
      const emptyFoldersIds = PromptsSelectors.selectEmptyFolderIds(state);
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

const applyPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.applyPrompt.type),
    switchMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),
    switchMap(({ prompt, wasUploaded }) => {
      if (!prompt) {
        return of(
          UIActions.showErrorToast(
            translate(
              'It looks like this prompt has been deleted. Please reload the page',
            ),
          ),
        );
      }

      const parsedVariables = parseVariablesFromContent(prompt.content);

      return concat(
        parsedVariables.length > 0
          ? of(PromptsActions.setPromptWithVariablesForApply(prompt))
          : of(ChatActions.appendInputContent(prompt.content ?? '')),
        // save in state to not upload again
        wasUploaded
          ? of(PromptsActions.updatePromptSuccess({ id: prompt.id, prompt }))
          : EMPTY,
      );
    }),
  );

const getPromptMetadataEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.getPromptMetadata.type),
    switchMap(({ payload }) =>
      PromptService.getPromptMetadata(payload.promptId).pipe(
        switchMap((promptMetadata) => {
          if (!promptMetadata) {
            return of(
              ChatActions.getEntityInfoFail({
                errorText: 'Could not get prompt info. Try again later',
              }),
            );
          }

          return concat(
            of(
              ChatActions.getEntityInfoSuccess({
                entityInfo: { id: payload.promptId, ...promptMetadata },
              }),
            ),

            of(
              PromptsActions.updatePromptSuccess({
                id: payload.promptId,
                prompt: {
                  updatedAt: promptMetadata.updatedAt,
                  createdAt: promptMetadata.createdAt,
                  author: promptMetadata.author,
                },
              }),
            ),
          );
        }),
        catchError(() => {
          return of(
            ChatActions.getEntityInfoFail({
              errorText: 'Could not get prompt info. Try again later',
            }),
          );
        }),
      ),
    ),
  );

const selectPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(PromptsActions.selectPrompt.type),
    switchMap(({ payload }) => {
      const actions: Observable<AppAction>[] = [];

      if (!payload.promptId) {
        const selectedPromptInfo = PromptsSelectors.selectSelectedPromptId(
          state$.value,
        );
        if (selectedPromptInfo?.selectedPromptId) {
          const { versionGroupId } = getVersionGroupFromId(
            selectedPromptInfo.selectedPromptId,
          );
          actions.push(
            of(
              PublicationActions.resetSelectedVersionForPublicVersionGroup({
                versionGroupId,
              }),
            ),
          );
        }
      } else if (isEntityIdPublic({ id: payload.promptId })) {
        const { versionGroupId, currentVersion } = getVersionGroupFromId(
          payload.promptId,
        );

        actions.push(
          of(
            PublicationActions.setSelectedVersionForPublicVersionGroup({
              versionGroupId,
              newVersion: { version: currentVersion, id: payload.promptId },
            }),
          ),
        );
      }

      if (payload.promptId) {
        actions.push(
          of(
            PromptsActions.uploadPrompt({
              promptId: payload.promptId,
            }),
          ),
        );
      }

      return concat(
        ...actions,
        of(
          PromptsActions.setSelectedPrompt({
            promptId: payload.promptId,
            isApproveRequiredResource: payload.isApproveRequiredResource,
          }),
        ),
        of(
          PromptsActions.setIsPromptModalOpen({
            isOpen: !!payload.promptId,
            isInitModeEdit: !!payload.selectInEditMode,
          }),
        ),
      );
    }),
  );

const hidePromptbarEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(PromptsActions.applyPrompt.type),
    switchMap(() =>
      isTabletScreen() ? of(UIActions.setShowPromptbar(false)) : EMPTY,
    ),
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
  movePromptEpic,
  movePromptFailEpic,
  updatePromptEpic,
  deletePromptEpic,
  clearPromptsEpic,
  deletePromptsEpic,
  updateFolderEpic,
  createNewPromptEpic,
  duplicatePromptEpic,
  uploadPromptEpic,
  deleteChosenPromptsEpic,
  applyPromptEpic,
  getPromptMetadataEpic,
  selectPromptEpic,
  hidePromptbarEpic,
);
