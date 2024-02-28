import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { isEntityExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { PromptsHistory } from '@/src/types/import-export';
import { Prompt, PromptInfo } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { PublishRequest } from '@/src/types/share';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-settings';

import * as PromptsSelectors from './prompts.selectors';
import { PromptsState } from './prompts.types';

export { PromptsSelectors };

const initialState: PromptsState = {
  promptsToMigrateCount: 0,
  migratedPromptsCount: 0,
  isPromptsBackedUp: false,
  failedMigratedPrompts: [],
  prompts: [],
  folders: [],
  temporaryFolders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
  selectedPromptId: undefined,
  isEditModalOpen: false,
  isModalPreviewMode: false,
  newAddedFolderId: undefined,
  promptsLoaded: false,
  isPromptLoading: false,
  loadingFolderIds: [],
  isActiveNewPromptRequest: false,
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    init: (state) => state,
    uploadPromptsWithFoldersRecursive: (state) => {
      state.promptsLoaded = false;
    },
    initPromptsSuccess: (state) => state,
    migratePromptsIfRequired: (state) => state,
    skipFailedMigratedPrompts: (
      state,
      { payload: _ }: PayloadAction<{ idsToMarkAsMigrated: string[] }>,
    ) => state,
    initPromptsMigration: (
      state,
      {
        payload,
      }: PayloadAction<{
        promptsToMigrateCount: number;
      }>,
    ) => {
      state.promptsToMigrateCount = payload.promptsToMigrateCount;
    },
    migratePromptFinish: (
      state,
      {
        payload,
      }: PayloadAction<{
        migratedPromptsCount: number;
      }>,
    ) => {
      state.migratedPromptsCount = payload.migratedPromptsCount;
    },
    setFailedMigratedPrompts: (
      state,
      {
        payload,
      }: PayloadAction<{
        failedMigratedPrompts: Prompt[];
      }>,
    ) => {
      state.failedMigratedPrompts = payload.failedMigratedPrompts;
    },
    setIsPromptsBackedUp: (
      state,
      {
        payload,
      }: PayloadAction<{
        isPromptsBackedUp: boolean;
      }>,
    ) => {
      state.isPromptsBackedUp = payload.isPromptsBackedUp;
    },
    createNewPrompt: (state) => {
      state.isActiveNewPromptRequest = true;
    },
    createNewPromptSuccess: (
      state,
      { payload }: PayloadAction<{ newPrompt: Prompt }>,
    ) => {
      state.prompts = state.prompts.concat(payload.newPrompt);
      state.selectedPromptId = payload.newPrompt.id;
      state.isActiveNewPromptRequest = false;
    },
    setIsActiveNewPromptRequest: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.isActiveNewPromptRequest = payload;
    },
    saveNewPrompt: (state, _action: PayloadAction<{ newPrompt: Prompt }>) =>
      state,
    deletePrompts: (
      state,
      { payload }: PayloadAction<{ promptsToRemove: PromptInfo[] }>,
    ) => {
      const promptToDeleteIds = payload.promptsToRemove.map(
        (prompt) => prompt.id,
      );

      state.prompts = state.prompts.filter(
        (p) => !promptToDeleteIds.includes(p.id),
      );
    },
    deletePromptsComplete: (
      state,
      { payload }: PayloadAction<{ deletePrompts: PromptInfo[] }>,
    ) => {
      const deleteIds = new Set(
        payload.deletePrompts.map((prompt) => prompt.id),
      );

      state.prompts = state.prompts.filter(
        (prompt) => !deleteIds.has(prompt.id),
      );
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
    publishPrompt: (state, { payload }: PayloadAction<PublishRequest>) => {
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.id) {
          return {
            ...prompt,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isPublished: true,
          };
        }

        return prompt;
      });
    },
    publishFolder: (state, { payload }: PayloadAction<PublishRequest>) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isPublished: true,
          };
        }

        return folder;
      });
    },
    unpublishPrompt: (state, { payload }: PayloadAction<{ id: string }>) => {
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.id) {
          return {
            ...prompt,
            //TODO: unpublish prompt by API
            isPublished: false,
          };
        }

        return prompt;
      });
    },
    unpublishFolder: (state, { payload }: PayloadAction<{ id: string }>) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: unpublish folder by API
            isPublished: false,
          };
        }

        return folder;
      });
    },
    duplicatePrompt: (state, _action: PayloadAction<PromptInfo>) => state,
    setPrompts: (
      state,
      {
        payload,
      }: PayloadAction<{ prompts: PromptInfo[]; ignoreCombining?: boolean }>,
    ) => {
      state.prompts = payload.ignoreCombining
        ? payload.prompts
        : combineEntities(state.prompts, payload.prompts);
      state.promptsLoaded = true;
    },
    addPrompts: (state, { payload }: PayloadAction<{ prompts: Prompt[] }>) => {
      state.prompts = state.prompts.concat(payload.prompts);
    },
    clearPrompts: (state) => {
      state.promptsLoaded = false;
    },
    clearPromptsSuccess: (state) => {
      state.prompts = state.prompts.filter(
        (prompt) =>
          isEntityExternal(prompt) ||
          PromptsSelectors.hasExternalParent(
            { prompts: state },
            prompt.folderId,
          ),
      );
      state.folders = state.folders.filter(
        (folder) =>
          isEntityExternal(folder) ||
          PromptsSelectors.hasExternalParent(
            { prompts: state },
            folder.folderId,
          ),
      );
    },
    exportPrompt: (state, _action: PayloadAction<{ id: string }>) => state,
    exportPrompts: (state) => state,
    importPrompts: (
      state,
      _action: PayloadAction<{ promptsHistory: PromptsHistory }>,
    ) => state,
    importPromptsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ prompts: Prompt[]; folders: FolderInterface[] }>,
    ) => {
      state.prompts = payload.prompts;
      state.folders = payload.folders;
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
        folderId: payload.relativePath,
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
      state.folders = state.folders.concat(payload.folders);
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
    },
    setSelectedPrompt: (
      state,
      { payload }: PayloadAction<{ promptId: string | undefined }>,
    ) => {
      state.selectedPromptId = payload.promptId;
      state.isPromptLoading = !!payload.promptId;
    },
    uploadPrompt: (state, _action: PayloadAction<{ promptId: string }>) => {
      state.isPromptLoading = true;
    },
    uploadPromptSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ prompt: Prompt | null; originalPromptId: string }>,
    ) => {
      state.isPromptLoading = false;
      const foundPromptIdx = state.prompts.findIndex(
        (prompt) => prompt.id === payload.prompt?.id,
      );

      if (foundPromptIdx !== -1) {
        state.prompts[foundPromptIdx] = payload.prompt as Prompt;
      } else {
        state.prompts = state.prompts.filter(
          (prompt) => prompt.id !== payload.originalPromptId,
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
  },
});

export const PromptsActions = promptsSlice.actions;
