import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getParentAndCurrentFolderIdsById,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';
import {
  doesPromptContainSearchTerm,
  getMyItemsFilters,
  searchSectionFolders,
} from '@/src/utils/app/search';
import { isEntityExternal } from '@/src/utils/app/share';

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
    (_state, _filters: EntityFilters, searchTerm?: string) => searchTerm,
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

export const selectSectionFolders = createSelector(
  [selectFolders, (_state, filters: EntityFilters) => filters],
  (folders, filters) => searchSectionFolders(folders, filters),
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
    return new Set(getChildAndCurrentFoldersIdsById(folderId, folders));
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

export const hasExternalParent = createSelector(
  [selectFolders, (_state: RootState, folderId?: string) => folderId],
  (folders, folderId?) => {
    const parentFolders = getParentAndCurrentFoldersById(folders, folderId);
    return parentFolders.some((folder) => isEntityExternal(folder));
  },
);

export const isPublishFolderVersionUnique = createSelector(
  [
    selectFolders,
    (_state: RootState, folderId: string) => folderId,
    (_state: RootState, _folderId: string, version: string) => version,
  ],
  (folders, folderId, version) => {
    const parentFolders = getParentAndCurrentFoldersById(folders, folderId);
    return parentFolders.some((folder) => folder.publishVersion === version);
  },
);

export const isPublishPromptVersionUnique = createSelector(
  [
    (state) => state,
    (_state: RootState, entityId: string) => entityId,
    (_state: RootState, _entityId: string, version: string) => version,
  ],
  (state, entityId, version) => {
    const prompt = selectPrompt(state, entityId);

    if (!prompt || prompt?.publishVersion === version) return false;

    const prompts = selectPrompts(state).filter(
      (prmt) => prmt.originalId === entityId && prmt.publishVersion === version,
    );

    if (prompts.length) return false;

    const folders = selectFolders(state);

    const parentFolders = getParentAndCurrentFoldersById(
      folders,
      prompt.folderId,
    );
    return parentFolders.every((folder) => folder.publishVersion !== version);
  },
);
