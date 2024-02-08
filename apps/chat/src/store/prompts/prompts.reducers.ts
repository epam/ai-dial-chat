import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  addGeneratedFolderId,
  generateNextName,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { addGeneratedPromptId } from '@/src/utils/app/prompts';
import { translate } from '@/src/utils/app/translation';

import { FolderInterface, FolderType } from '@/src/types/folder';
import { PromptsHistory } from '@/src/types/importExport';
import { Prompt } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { PublishRequest } from '@/src/types/share';

import { resetShareEntity } from '@/src/constants/chat';
import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-settings';

import * as PromptsSelectors from './prompts.selectors';
import { PromptsState } from './prompts.types';

import { v4 as uuidv4 } from 'uuid';

export { PromptsSelectors };

const initialState: PromptsState = {
  prompts: [],
  folders: [],
  temporaryFolders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
  selectedPromptId: undefined,
  isEditModalOpen: false,
  newAddedFolderId: undefined,
  promptsLoaded: false,
  isPromptLoading: false,
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    init: (state) => state,
    // initFolders: (state) => state,
    initPrompts: (state) => state,
    createNewPrompt: (state) => {
      const newPrompt: Prompt = addGeneratedPromptId({
        name: getNextDefaultName(
          translate('Prompt'),
          state.prompts.filter((prompt) => !prompt.folderId), // only root prompts
        ),
        description: '',
        content: '',
      });
      state.prompts = state.prompts.concat(newPrompt);
      state.selectedPromptId = newPrompt.id;
    },
    deletePrompts: (
      state,
      { payload }: PayloadAction<{ promptIds: string[] }>,
    ) => {
      state.prompts = state.prompts.filter(
        (p) => !payload.promptIds.includes(p.id),
      );
    },
    updatePrompt: (state, { payload }: PayloadAction<{ prompt: Prompt }>) => {
      const foundPromptIdx = state.prompts.findIndex(
        (prompt) => prompt.id === payload.prompt.id,
      );

      if (foundPromptIdx !== -1) {
        state.prompts[foundPromptIdx] = payload.prompt;
      }
    },
    sharePrompt: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.id) {
          return {
            ...prompt,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isShared: true,
          };
        }

        return prompt;
      });
    },
    shareFolder: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isShared: true,
          };
        }

        return folder;
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
    unpublishPrompt: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
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
    unpublishFolder: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
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
    duplicatePrompt: (
      state,
      { payload }: PayloadAction<{ prompt: Prompt }>,
    ) => {
      const newPrompt: Prompt = addGeneratedPromptId({
        ...payload.prompt,
        ...resetShareEntity,
        folderId: undefined,
        name: generateNextName(
          translate('Prompt'),
          payload.prompt.name,
          state.prompts,
        ),
      });
      state.prompts = state.prompts.concat(newPrompt);
      state.selectedPromptId = newPrompt.id;
    },
    updatePrompts: (
      state,
      { payload }: PayloadAction<{ prompts: Prompt[] }>,
    ) => {
      state.prompts = payload.prompts;
      state.promptsLoaded = true;
    },
    addPrompts: (state, { payload }: PayloadAction<{ prompts: Prompt[] }>) => {
      state.prompts = state.prompts.concat(payload.prompts);
    },
    clearPrompts: (state) => {
      state.prompts = [];
      state.folders = [];
    },
    exportPrompt: (state, _action: PayloadAction<{ promptId: string }>) =>
      state,
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
      {
        payload,
      }: PayloadAction<{ name?: string; parentId?: string } | undefined>,
    ) => {
      const newFolder: FolderInterface = addGeneratedFolderId({
        folderId: payload?.parentId,
        name:
          // custom name
          payload?.name ??
          // default name with counter
          PromptsSelectors.selectNewFolderName({ prompts: state }),
        type: FolderType.Prompt,
      });

      state.folders = state.folders.concat(newFolder);
    },
    createTemporaryFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        relativePath?: string;
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
      const id = uuidv4();

      state.temporaryFolders.push({
        id,
        name: folderName,
        type: FolderType.Prompt,
        folderId: payload.relativePath,
        temporary: true,
      });
      state.newAddedFolderId = id;
    },
    deleteFolder: (state, { payload }: PayloadAction<{ folderId: string }>) => {
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
    renameFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      const name = payload.name.trim();
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            name,
          };
        }

        return folder;
      });
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
    moveFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        newParentFolderId: string | undefined;
      }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return addGeneratedFolderId({
            ...folder,
            folderId: payload.newParentFolderId,
          });
        }

        return folder;
      });
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
      { payload }: PayloadAction<{ isOpen: boolean }>,
    ) => {
      state.isEditModalOpen = payload.isOpen;
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
  },
});

export const PromptsActions = promptsSlice.actions;
