import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { generateNextName, getNextDefaultName } from '@/src/utils/app/folders';
import { translate } from '@/src/utils/app/translation';

import { PromptsHistory } from '@/src/types/export';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { SearchFilters } from '@/src/types/search';
import { PublishRequest } from '@/src/types/share';

import { resetShareEntity } from './../../constants/chat';

import { PromptsState } from './prompts.types';

import { v4 as uuidv4 } from 'uuid';

export * as PromptsSelectors from './prompts.selectors';

const initialState: PromptsState = {
  prompts: [],
  folders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
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
    createNewPrompt: (state) => {
      const newPrompt: Prompt = {
        id: uuidv4(),
        name: getNextDefaultName(translate('Prompt'), state.prompts),
        description: '',
        content: '',
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
      state.prompts = state.prompts.map((prompt) => {
        if (prompt.id === payload.promptId) {
          return {
            ...prompt,
            ...payload.values,
          };
        }

        return prompt;
      });
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
      const newPrompt: Prompt = {
        ...payload.prompt,
        ...resetShareEntity,
        folderId: undefined,
        name: generateNextName(
          translate('Prompt'),
          payload.prompt.name,
          state.prompts,
        ),
        id: uuidv4(),
      };
      state.prompts = state.prompts.concat(newPrompt);
      state.selectedPromptId = newPrompt.id;
    },
    updatePrompts: (
      state,
      { payload }: PayloadAction<{ prompts: Prompt[] }>,
    ) => {
      state.prompts = payload.prompts;
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
      }: PayloadAction<{ name?: string; folderId?: string } | undefined>,
    ) => {
      const newFolder: FolderInterface = {
        id: payload?.folderId || uuidv4(),
        name:
          payload?.name ?? // custom name
          getNextDefaultName(translate('New folder'), state.folders), // default name with counter
        type: FolderType.Prompt,
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
    },
  },
});

export const PromptsActions = promptsSlice.actions;
