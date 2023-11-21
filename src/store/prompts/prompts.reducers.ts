import { i18n } from 'next-i18next';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';

import { PromptsHistory } from '@/src/types/export';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { RootState } from '../index';

import { v4 as uuidv4 } from 'uuid';

export interface PromptsState {
  prompts: Prompt[];
  folders: FolderInterface[];
  searchTerm: string;
  selectedPromptId: string | undefined;
  isEditModalOpen: boolean;
}

const initialState: PromptsState = {
  prompts: [],
  folders: [],
  searchTerm: '',
  selectedPromptId: undefined,
  isEditModalOpen: false,
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    init: (state) => state,
    initFolders: (state) => state,
    initPrompts: (state) => state,
    createNewPrompt: (state) => state,
    createNewPromptSuccess: (
      state,
      { payload }: PayloadAction<{ model: OpenAIEntityModel }>,
    ) => {
      const newPrompt: Prompt = {
        id: uuidv4(),
        name: (i18n as any).t(`Prompt ${state.prompts.length + 1}`),
        description: '',
        content: '',
        model: payload.model,
      };
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
    updatePrompt: (
      state,
      { payload }: PayloadAction<{ promptId: string; values: Partial<Prompt> }>,
    ) => {
      state.prompts = state.prompts.map((conv) => {
        if (conv.id === payload.promptId) {
          return {
            ...conv,
            ...payload.values,
          };
        }

        return conv;
      });
    },
    updatePrompts: (
      state,
      { payload }: PayloadAction<{ prompts: Prompt[] }>,
    ) => {
      state.prompts = payload.prompts;
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
      { payload }: PayloadAction<{ name: string; folderId?: string }>,
    ) => {
      const newFolder: FolderInterface = {
        id: payload.folderId || uuidv4(),
        name: payload.name,
        type: 'prompt',
      };

      state.folders = state.folders.concat(newFolder);
    },
    deleteFolder: (state, { payload }: PayloadAction<{ folderId: string }>) => {
      state.folders = state.folders.filter(({ id }) => id !== payload.folderId);
    },
    renameFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      const name = payload.name.trim();
      if (name === '') {
        return;
      }
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
    moveFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        newParentFolderId: string | undefined;
        newIndex: number;
      }>,
    ) => {
      const folderIndex = state.folders.findIndex(
        (folder) => folder.id === payload.folderId,
      );
      const updatedFolderContent = {
        ...state.folders[folderIndex],
        folderId: payload.newParentFolderId,
      };
      state.folders = state.folders
        .toSpliced(folderIndex, 1)
        .toSpliced(
          folderIndex < payload.newIndex
            ? payload.newIndex - 1
            : payload.newIndex,
          0,
          updatedFolderContent,
        );
    },
    setFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = payload.folders;
    },
    setSearchTerm: (
      state,
      { payload }: PayloadAction<{ searchTerm: string }>,
    ) => {
      state.searchTerm = payload.searchTerm;
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
    },
  },
});

const rootSelector = (state: RootState): PromptsState => state.prompts;

const selectPrompts = createSelector([rootSelector], (state) => {
  return state.prompts;
});
const selectPrompt = createSelector(
  [selectPrompts, (_state, promptId: string) => promptId],
  (prompts, promptId) => {
    return prompts.find((prompt) => prompt.id === promptId);
  },
);
const selectFolders = createSelector([rootSelector], (state) => {
  return state.folders;
});
const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);
const selectParentFoldersIds = createSelector(
  [selectParentFolders],
  (folders) => {
    return folders.map((folder) => folder.id);
  },
);
const selectChildAndCurrentFoldersIdsById = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getChildAndCurrentFoldersIdsById(folderId, folders);
  },
);
const selectSearchTerm = createSelector([rootSelector], (state) => {
  return state.searchTerm;
});

const selectSearchedPrompts = createSelector(
  [selectPrompts, selectSearchTerm],
  (prompts, searchTerm) => {
    return prompts.filter((prompt) => {
      const searchable =
        prompt.name.toLowerCase() +
        ' ' +
        prompt.description?.toLowerCase() +
        ' ' +
        prompt.content?.toLowerCase();
      return searchable.includes(searchTerm.toLowerCase());
    });
  },
);

const selectIsEditModalOpen = createSelector([rootSelector], (state) => {
  return state.isEditModalOpen;
});

const selectSelectedPromptId = createSelector([rootSelector], (state) => {
  return state.selectedPromptId;
});

const selectSelectedPrompt = createSelector(
  [selectPrompts, selectSelectedPromptId],
  (prompts, selectedPromptId): Prompt | undefined => {
    if (!selectedPromptId) {
      return undefined;
    }
    return prompts.find((prompt) => prompt.id === selectedPromptId);
  },
);

const selectSelectedPromptFoldersIds = createSelector(
  [selectSelectedPrompt, (state) => state],
  (prompt, state) => {
    let selectedFolders: string[] = [];

    selectedFolders = selectedFolders.concat(
      selectParentFoldersIds(state, prompt?.folderId),
    );

    return selectedFolders;
  },
);

export const PromptsSelectors = {
  selectPrompts,
  selectPrompt,
  selectFolders,
  selectSearchTerm,
  selectSearchedPrompts,
  selectSelectedPromptId,
  selectSelectedPrompt,
  selectIsEditModalOpen,
  selectSelectedPromptFoldersIds,
  selectParentFolders,
  selectParentFoldersIds,
  selectChildAndCurrentFoldersIdsById,
};

export const PromptsActions = promptsSlice.actions;
