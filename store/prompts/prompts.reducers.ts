import { i18n } from 'next-i18next';

import { PromptsHistory } from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityModel } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { RootState } from '../index';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

export interface PromptsState {
  prompts: Prompt[];
  folders: FolderInterface[];
  searchTerm: string;
}

const initialState: PromptsState = {
  prompts: [],
  folders: [],
  searchTerm: '',
};

export const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
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
        folderId: null,
      };
      state.prompts = state.prompts.concat(newPrompt);
    },
    deletePrompt: (state, { payload }: PayloadAction<{ promptId: string }>) => {
      state.prompts = state.prompts.filter((p) => p.id !== payload.promptId);
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
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            name: payload.name,
          };
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
    setSearchTerm: (
      state,
      { payload }: PayloadAction<{ searchTerm: string }>,
    ) => {
      state.searchTerm = payload.searchTerm;
    },
  },
});

const rootSelector = (state: RootState) => state.prompts;

const selectPrompts = createSelector([rootSelector], (state) => {
  return state.prompts;
});
const selectFolders = createSelector([rootSelector], (state) => {
  return state.folders;
});
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
        prompt.description.toLowerCase() +
        ' ' +
        prompt.content.toLowerCase();
      return searchable.includes(searchTerm.toLowerCase());
    });
  },
);

export const PromptsSelectors = {
  selectPrompts,
  selectFolders,
  selectSearchTerm,
  selectSearchedPrompts,
};

export const PromptsActions = promptsSlice.actions;
