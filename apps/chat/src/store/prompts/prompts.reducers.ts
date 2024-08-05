import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getPromptRootId, isRootPromptId } from '@/src/utils/app/id';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import {
  isEntityExternal,
  isEntityOrParentsExternal,
} from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import '@/src/types/share';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import * as PromptsSelectors from './prompts.selectors';
import { PromptsState } from './prompts.types';

import uniq from 'lodash-es/uniq';

export { PromptsSelectors };

const initialState: PromptsState = {
  prompts: [],
  folders: [],
  temporaryFolders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
  selectedPromptId: undefined,
  isSelectedPromptApproveRequiredResource: false,
  isEditModalOpen: false,
  isModalPreviewMode: false,
  newAddedFolderId: undefined,
  promptsLoaded: false,
  isPromptLoading: false,
  loadingFolderIds: [],
  isNewPromptCreating: false,
  chosenPromptIds: [],
  chosenFolderIds: [],
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    init: (state) => state,
    initFoldersAndPromptsSuccess: (state) => {
      state.promptsLoaded = true;
    },
    uploadPromptsWithFoldersRecursive: (
      state,
      {
        payload,
      }: PayloadAction<
        { path?: string; selectFirst?: boolean; noLoader?: boolean } | undefined
      >,
    ) => {
      state.promptsLoaded = !!payload?.noLoader;
    },
    uploadPromptsWithFoldersRecursiveSuccess: (state) => {
      state.promptsLoaded = true;
    },
    createNewPrompt: (state, _action: PayloadAction<Prompt>) => state,
    createNewPromptSuccess: (
      state,
      { payload }: PayloadAction<{ newPrompt: Prompt }>,
    ) => {
      state.prompts = state.prompts.concat(payload.newPrompt);
      state.isNewPromptCreating = false;
    },
    setIsNewPromptCreating: (state, { payload }: PayloadAction<boolean>) => {
      state.isNewPromptCreating = payload;
    },
    saveNewPrompt: (state, _action: PayloadAction<{ newPrompt: Prompt }>) =>
      state,
    deletePrompts: (state, _action: PayloadAction<{ promptIds: string[] }>) =>
      state,
    deletePromptsComplete: (
      state,
      { payload }: PayloadAction<{ promptIds: Set<string> }>,
    ) => {
      state.prompts = state.prompts.filter(
        (prompt) => !payload.promptIds.has(prompt.id),
      );
      state.promptsLoaded = true;
    },
    deletePrompt: (
      state,
      { payload }: PayloadAction<{ prompt: PromptInfo }>,
    ) => {
      state.prompts = state.prompts.filter(
        (prompt) => prompt.id !== payload.prompt.id,
      );
    },
    savePrompt: (state, _action: PayloadAction<Prompt>) => state,
    recreatePrompt: (
      state,
      _action: PayloadAction<{ new: Prompt; old: PromptInfo }>,
    ) => state,
    recreatePromptFail: (
      state,
      { payload }: PayloadAction<{ oldPrompt: Prompt; newId: string }>,
    ) => {
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.newId) {
          return {
            ...prompt,
            ...payload.oldPrompt,
          };
        }

        return prompt;
      });
    },
    updatePrompt: (
      state,
      _action: PayloadAction<{ id: string; values: Partial<Prompt> }>,
    ) => state,
    updatePromptSuccess: (
      state,
      { payload }: PayloadAction<{ prompt: Partial<Prompt>; id: string }>,
    ) => {
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.id) {
          return {
            ...prompt,
            ...payload.prompt,
          };
        }

        return prompt;
      });
    },
    duplicatePrompt: (state, _action: PayloadAction<PromptInfo>) => state,
    setPrompts: (
      state,
      { payload }: PayloadAction<{ prompts: PromptInfo[] }>,
    ) => {
      state.prompts = payload.prompts;
      state.promptsLoaded = true;
    },
    addPrompts: (state, { payload }: PayloadAction<{ prompts: Prompt[] }>) => {
      state.prompts = combineEntities(payload.prompts, state.prompts);
    },
    clearPrompts: (state) => {
      state.promptsLoaded = false;
    },
    clearPromptsSuccess: (state) => {
      state.prompts = state.prompts.filter((prompt) =>
        isEntityOrParentsExternal(
          { prompts: state },
          prompt,
          FeatureType.Prompt,
        ),
      );
      state.folders = state.folders.filter((folder) =>
        isEntityOrParentsExternal(
          { prompts: state },
          folder,
          FeatureType.Prompt,
        ),
      );
    },
    importPromptsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ prompts: Prompt[]; folders: FolderInterface[] }>,
    ) => {
      state.prompts = combineEntities(payload.prompts, state.prompts);
      state.folders = combineEntities(payload.folders, state.folders);
    },
    createFolder: (
      state,
      { payload }: PayloadAction<{ name?: string; parentId: string }>,
    ) => {
      const newFolder: FolderInterface = addGeneratedFolderId({
        folderId: payload.parentId,
        name:
          // custom name
          payload?.name ??
          // default name with counter
          PromptsSelectors.selectNewFolderName(
            {
              prompts: state,
            },
            payload.parentId,
          ),
        type: FolderType.Prompt,
        status: UploadStatus.LOADED,
      });

      state.folders = state.folders.concat(newFolder);
    },
    createTemporaryFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        relativePath: string;
      }>,
    ) => {
      const folderName = getNextDefaultName(
        translate(DEFAULT_FOLDER_NAME),
        [
          ...state.temporaryFolders,
          ...state.folders.filter((folder) => folder.publishedWithMe),
        ],
        0,
        false,
        true,
      );
      const id = constructPath(
        payload.relativePath || getPromptRootId(),
        folderName,
      );

      state.temporaryFolders.push({
        id,
        name: folderName,
        type: FolderType.Prompt,
        folderId: payload.relativePath || getPromptRootId(),
        temporary: true,
      });
      state.newAddedFolderId = id;
    },
    deleteFolder: (
      state,
      { payload }: PayloadAction<{ folderId?: string }>,
    ) => {
      state.folders = state.folders.filter(({ id }) => id !== payload.folderId);
    },
    deleteTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      state.temporaryFolders = state.temporaryFolders.filter(
        ({ id }) => id !== payload.folderId,
      );
    },
    deleteAllTemporaryFolders: (state) => {
      state.temporaryFolders = [];
    },
    renameTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      state.newAddedFolderId = undefined;
      const name = payload.name.trim();

      state.temporaryFolders = state.temporaryFolders.map((folder) =>
        folder.id !== payload.folderId ? folder : { ...folder, name },
      );
    },
    resetNewFolderId: (state) => {
      state.newAddedFolderId = undefined;
    },
    updateFolder: (
      state,
      {
        payload,
      }: PayloadAction<{ folderId: string; values: Partial<FolderInterface> }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            ...payload.values,
          };
        }

        return folder;
      });
    },
    updateFolderSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        folders: FolderInterface[];
        prompts: PromptInfo[];
      }>,
    ) => {
      state.folders = payload.folders;
      state.prompts = payload.prompts;
    },
    setFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = payload.folders;
    },
    addFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = combineEntities(state.folders, payload.folders);
    },
    setSearchTerm: (
      state,
      { payload }: PayloadAction<{ searchTerm: string }>,
    ) => {
      state.searchTerm = payload.searchTerm;
    },
    setSearchFilters: (
      state,
      { payload }: PayloadAction<{ searchFilters: SearchFilters }>,
    ) => {
      state.searchFilters = payload.searchFilters;
    },
    resetSearch: (state) => {
      state.searchTerm = '';
      state.searchFilters = SearchFilters.None;
    },
    setIsEditModalOpen: (
      state,
      {
        payload: { isOpen, isPreview = false },
      }: PayloadAction<{ isOpen: boolean; isPreview?: boolean }>,
    ) => {
      state.isEditModalOpen = isOpen;
      state.isModalPreviewMode = isPreview;
      if (!isOpen) {
        state.isNewPromptCreating = false;
      }
    },
    setSelectedPrompt: (
      state,
      {
        payload,
      }: PayloadAction<{
        promptId: string | undefined;
        isApproveRequiredResource?: boolean;
      }>,
    ) => {
      state.selectedPromptId = payload.promptId;
      state.isSelectedPromptApproveRequiredResource =
        !!payload.isApproveRequiredResource;
      state.isPromptLoading = !!payload.promptId;
    },
    uploadPrompt: (state, _action: PayloadAction<{ promptId: string }>) => {
      state.isPromptLoading = true;
    },
    uploadPromptSuccess: (
      state,
      { payload }: PayloadAction<{ prompt: Prompt | null }>,
    ) => {
      state.isPromptLoading = false;

      if (payload.prompt) {
        state.prompts = state.prompts.map((prompt) =>
          prompt.id === payload.prompt?.id
            ? { ...payload.prompt, ...prompt }
            : prompt,
        );
      }
    },
    toggleFolder: (state, _action: PayloadAction<{ id: string }>) => state,
    uploadChildPromptsWithFolders: (
      state,
      {
        payload,
      }: PayloadAction<{
        ids: string[];
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.concat(
        payload.ids as string[],
      );
    },
    uploadChildPromptsWithFoldersSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        parentIds: string[];
        folders: FolderInterface[];
        prompts: PromptInfo[];
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.filter(
        (id) => !payload.parentIds.includes(id),
      );
      state.folders = combineEntities(
        state.folders,
        payload.folders.map((folder) => ({
          ...folder,
          status: payload.parentIds.includes(folder.id)
            ? UploadStatus.LOADED
            : undefined,
        })),
      );
      state.prompts = combineEntities(state.prompts, payload.prompts);
    },
    setChosenPrompt: (
      state,
      {
        payload: { promptId, isChosen },
      }: PayloadAction<{ promptId: string; isChosen: boolean }>,
    ) => {
      if (isChosen) {
        const parentFolderIds = state.chosenFolderIds.filter((folderId) =>
          promptId.startsWith(folderId),
        );
        if (parentFolderIds.length) {
          state.chosenFolderIds = uniq([
            ...state.chosenFolderIds.filter(
              (folderId) => !promptId.startsWith(folderId),
            ),
            ...state.folders
              .map((folder) => `${folder.id}/`)
              .filter(
                (folderId) =>
                  !promptId.startsWith(folderId) &&
                  parentFolderIds.some((parentId) => folderId.startsWith(parentId)) &&
                  state.prompts
                    .filter((prompt) => doesEntityContainSearchTerm(prompt, state.searchTerm))
                    .some((prompt) => prompt.id.startsWith(folderId)),
              ),
          ]);
          state.chosenPromptIds = uniq([
            ...state.chosenPromptIds.filter(
              (convId: string) => convId !== promptId,
            ),
            ...state.prompts
              .filter(
                (prompt) =>
                  prompt.id !== promptId &&
                  parentFolderIds.some((parentId) =>
                    prompt.id.startsWith(parentId),
                  ) &&
                  doesEntityContainSearchTerm(prompt, state.searchTerm),
              )
              .map((prompt) => prompt.id),
          ]);
        } else {
          state.chosenPromptIds = state.chosenPromptIds.filter(
            (prId: string) => prId !== promptId,
          );
        }
      } else {
        state.chosenPromptIds = uniq([...state.chosenPromptIds, promptId]);
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds,
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (folderId) =>
                promptId.startsWith(folderId) &&
                !state.prompts
                  .filter((prompt) =>
                    doesEntityContainSearchTerm(prompt, state.searchTerm),
                  )
                  .some(
                    (prompt) =>
                      prompt.id.startsWith(folderId) &&
                      !state.chosenPromptIds.includes(prompt.id) &&
                      !state.chosenFolderIds.some((chosenFolderId) =>
                        prompt.id.startsWith(chosenFolderId),
                      ),
                  ),
            ),
        ]);
      }
    },
    setChosenFolder: (
      state,
      {
        payload: { folderId, isChosen },
      }: PayloadAction<{ folderId: string; isChosen: boolean }>,
    ) => {
      if (isChosen) {
        const parentFolderIds = state.chosenFolderIds.filter(
          (chosenId) => folderId.startsWith(chosenId) || chosenId !== folderId,
        );
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds.filter(
            (chosenId) =>
              !folderId.startsWith(chosenId) && !chosenId.startsWith(folderId),
          ),
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (fid) =>
                !fid.startsWith(folderId) &&
                !folderId.startsWith(fid) &&
                parentFolderIds.some((parentId) => fid.startsWith(parentId)),
            ),
        ]);
        state.chosenPromptIds = uniq([
          ...state.chosenPromptIds.filter(
            (convId: string) => !convId.startsWith(folderId),
          ),
          ...state.prompts
            .filter(
              (prompt) =>
                doesEntityContainSearchTerm(prompt, state.searchTerm) &&
                !prompt.id.startsWith(folderId) &&
                parentFolderIds.some((parentId) => prompt.id.startsWith(parentId))
            )
            .map((prompt) => prompt.id),
        ]);
      } else {
        state.chosenPromptIds = state.chosenPromptIds.filter(
          (convId: string) => !convId.startsWith(folderId),
        );
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds.filter(
            (chosenId) => !chosenId.startsWith(folderId),
          ),
          folderId,
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (fid) =>
                folderId.startsWith(fid) &&
                !state.prompts
                  .filter((prompt) =>
                    doesEntityContainSearchTerm(prompt, state.searchTerm),
                  )
                  .some(
                  (prompt) =>
                    prompt.id.startsWith(fid) &&
                    !prompt.id.startsWith(folderId) &&
                    !state.chosenPromptIds.includes(prompt.id) &&
                    !state.chosenFolderIds.some((chosenFolderId) =>
                      prompt.id.startsWith(chosenFolderId),
                    ),
                ),
            ),
        ]);
      }
    },
    resetChosenPrompts: (state) => {
      state.chosenPromptIds = [];
      state.chosenFolderIds = [];
    },
    setAllChosenPrompts: (state) => {
      if (state.searchTerm) {
        state.chosenPromptIds = state.prompts
          .filter(
            (prompt) =>
              !isEntityExternal(prompt) &&
              doesEntityContainSearchTerm(prompt, state.searchTerm),
          )
          .map(({ id }) => id);
      } else {
        state.chosenPromptIds = state.prompts
          .filter(
            (conv) => !isEntityExternal(conv) && isRootPromptId(conv.folderId),
          )
          .map(({ id }) => id);
        state.chosenFolderIds = state.folders
          .filter(
            (folder) =>
              !isEntityExternal(folder) && isRootPromptId(folder.folderId),
          )
          .map(({ id }) => `${id}/`);
      }
    },
    deleteChosenPrompts: (state) => state,
  },
});

export const PromptsActions = promptsSlice.actions;
