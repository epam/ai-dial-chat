import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getParentAndCurrentFolderIdsById,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';
import {
  doesPromptContainSearchTerm,
  getMyItemsFilters,
} from '@/src/utils/app/search';

import { Prompt } from '@/src/types/prompt';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import { RootState } from '../index';
import { PromptsState } from './prompts.types';

const rootSelector = (state: RootState): PromptsState => state.prompts;

export const selectPrompts = createSelector([rootSelector], (state) => {
  return state.prompts;
});

export const selectFilteredPrompts = createSelector(
  [
    selectPrompts,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm?: string) => searchTerm,
  ],
  (prompts, filters, searchTerm?) => {
    return prompts.filter(
      (prompt) =>
        (!searchTerm || doesPromptContainSearchTerm(prompt, searchTerm)) &&
        filters.searchFilter(prompt) &&
        (prompt.folderId || filters.sectionFilter(prompt)),
    );
  },
);

export const selectPrompt = createSelector(
  [selectPrompts, (_state, promptId: string) => promptId],
  (prompts, promptId) => {
    return prompts.find((prompt) => prompt.id === promptId);
  },
);

export const selectFolders = createSelector([rootSelector], (state) => {
  return state.folders;
});

export const selectEmptyFolderIds = createSelector(
  [selectFolders, selectPrompts],
  (folders, prompts) => {
    return folders
      .filter(
        ({ id }) =>
          !folders.some((folder) => folder.folderId === id) &&
          !prompts.some((conv) => conv.folderId === id),
      )
      .map(({ id }) => id);
  },
);

export const selectFilteredFolders = createSelector(
  [
    (state) => state,
    selectFolders,
    selectEmptyFolderIds,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm?: string) => searchTerm,
    (_state, _filters, _searchTerm?, includeEmptyFolders?: boolean) =>
      includeEmptyFolders,
  ],
  (
    state,
    folders,
    emptyFolderIds,
    filters,
    searchTerm?,
    includeEmptyFolders?,
  ) => {
    const filteredPrompts = selectFilteredPrompts(state, filters, searchTerm);
    const folderIds = filteredPrompts // direct parent folders
      .map((c) => c.folderId)
      .filter((fid) => fid);

    if (!searchTerm?.trim().length) {
      const markedFolderIds = folders
        .filter((folder) => filters?.searchFilter(folder))
        .map((f) => f.id);
      folderIds.push(...markedFolderIds);

      if (includeEmptyFolders && !searchTerm?.length) {
        // include empty folders only if not search
        folderIds.push(...emptyFolderIds);
      }
    }

    const filteredFolderIds = new Set(
      folderIds.flatMap((fid) =>
        getParentAndCurrentFolderIdsById(folders, fid),
      ),
    );

    return folders.filter(
      (folder) =>
        (folder.folderId || filters.sectionFilter(folder)) &&
        filteredFolderIds.has(folder.id),
    );
  },
);

export const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);

export const selectParentFoldersIds = createSelector(
  [selectParentFolders],
  (folders) => {
    return folders.map((folder) => folder.id);
  },
);

export const selectChildAndCurrentFoldersIdsById = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getChildAndCurrentFoldersIdsById(folderId, folders);
  },
);

export const selectSearchTerm = createSelector([rootSelector], (state) => {
  return state.searchTerm;
});

export const selectSearchFilters = createSelector(
  [rootSelector],
  (state) => state.searchFilters,
);

export const selectIsEmptySearchFilter = createSelector(
  [rootSelector],
  (state) => state.searchFilters === SearchFilters.None,
);

export const selectMyItemsFilters = createSelector(
  [selectSearchFilters],
  (searchFilters) => getMyItemsFilters(searchFilters),
);

export const selectSearchedPrompts = createSelector(
  [selectPrompts, selectSearchTerm],
  (prompts, searchTerm) => {
    return prompts.filter((prompt) =>
      doesPromptContainSearchTerm(prompt, searchTerm),
    );
  },
);

export const selectIsEditModalOpen = createSelector([rootSelector], (state) => {
  return state.isEditModalOpen;
});

export const selectSelectedPromptId = createSelector(
  [rootSelector],
  (state) => {
    return state.selectedPromptId;
  },
);

export const selectSelectedPrompt = createSelector(
  [selectPrompts, selectSelectedPromptId],
  (prompts, selectedPromptId): Prompt | undefined => {
    if (!selectedPromptId) {
      return undefined;
    }
    return prompts.find((prompt) => prompt.id === selectedPromptId);
  },
);

export const selectSelectedPromptFoldersIds = createSelector(
  [selectSelectedPrompt, (state) => state],
  (prompt, state) => {
    let selectedFolders: string[] = [];

    selectedFolders = selectedFolders.concat(
      selectParentFoldersIds(state, prompt?.folderId),
    );

    return selectedFolders;
  },
);
