import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  doesPromptOrConversationContainSearchTerm,
  getMyItemsFilters,
  searchSectionFolders,
} from '@/src/utils/app/search';
import { isEntityExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';
import { ApiKeys } from '@/src/utils/server/api';

import { Prompt } from '@/src/types/prompt';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-settings';

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
        (!searchTerm ||
          doesPromptOrConversationContainSearchTerm(prompt, searchTerm)) &&
        filters.searchFilter(prompt) &&
        filters.sectionFilter(prompt),
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
    allFolders,
    emptyFolderIds,
    filters,
    searchTerm?,
    includeEmptyFolders?,
  ) =>
    getFilteredFolders({
      allFolders,
      emptyFolderIds,
      filters,
      entities: selectFilteredPrompts(state, filters, searchTerm),
      searchTerm,
      includeEmptyFolders,
    }),
);

export const selectSectionFolders = createSelector(
  [selectFolders, (_state, filters: EntityFilters) => filters],
  (folders, filters) => searchSectionFolders(folders, filters),
);

export const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string) => folderId],
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
  [selectFolders, (_state, folderId: string) => folderId],
  (folders, folderId) => {
    return new Set(getChildAndCurrentFoldersIdsById(folderId, folders));
  },
);
export const selectFullTreeChildPromptsByFolderId = createSelector(
  [selectPrompts, selectChildAndCurrentFoldersIdsById],
  (prompts, foldersIds) => {
    return prompts.filter((conv) => foldersIds.has(conv.folderId));
  },
);
export const selectFullTreeChildFoldersByFolderId = createSelector(
  [selectFolders, selectChildAndCurrentFoldersIdsById],
  (folders, foldersIds) => {
    return folders.filter((folder) => foldersIds.has(folder.id));
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
      doesPromptOrConversationContainSearchTerm(prompt, searchTerm),
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

    return prompts.find((prompt) => prompt.id === selectedPromptId) as Prompt;
  },
);

export const selectSelectedPromptFoldersIds = createSelector(
  [selectSelectedPrompt, (state) => state],
  (prompt, state) => {
    let selectedFolders: string[] = [];

    selectedFolders = prompt
      ? selectedFolders.concat(selectParentFoldersIds(state, prompt.folderId))
      : [];

    return selectedFolders;
  },
);

export const hasExternalParent = createSelector(
  [selectFolders, (_state: RootState, folderId: string) => folderId],
  (folders, folderId) => {
    const rootID = getRootId({ apiKey: ApiKeys.Prompts });
    if (!folderId.startsWith(rootID)) {
      return true;
    }
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
    return parentFolders.every((folder) => folder.publishVersion !== version);
  },
);

export const isPublishPromptVersionUnique = createSelector(
  [
    (state) => state,
    (_state: RootState, entityId: string) => entityId,
    (_state: RootState, _entityId: string, version: string) => version,
  ],
  (state, entityId, version) => {
    const prompt = selectPrompt(state, entityId) as Prompt; // TODO: will be fixed in https://github.com/epam/ai-dial-chat/issues/313;

    if (!prompt || prompt?.publishVersion === version) return false;

    const prompts = selectPrompts(state)
      .map((prompt) => prompt as Prompt)
      .filter(
        (prmt) =>
          prmt.originalId === entityId && prmt.publishVersion === version,
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
export const selectTemporaryFolders = createSelector(
  [rootSelector],
  (state: PromptsState) => {
    return state.temporaryFolders;
  },
);
export const selectPublishedWithMeFolders = createSelector(
  [selectFolders],
  (folders) => {
    return folders.filter((folder) =>
      PublishedWithMeFilter.sectionFilter(folder),
    );
  },
);

export const selectTemporaryAndFilteredFolders = createSelector(
  [
    selectFolders,
    selectPublishedWithMeFolders,
    selectTemporaryFolders,
    (_state, searchTerm?: string) => searchTerm,
  ],
  (allFolders, filteredFolders, temporaryFolders, searchTerm = '') => {
    const filtered = [...filteredFolders, ...temporaryFolders].filter(
      (folder) => folder.name.includes(searchTerm.toLowerCase()),
    );

    return getParentAndChildFolders(allFolders, filtered);
  },
);

export const selectNewAddedFolderId = createSelector(
  [rootSelector],
  (state) => {
    return state.newAddedFolderId;
  },
);

export const arePromptsUploaded = createSelector([rootSelector], (state) => {
  return state.promptsLoaded;
});

export const isPromptLoading = createSelector([rootSelector], (state) => {
  return state.isPromptLoading;
});

export const selectPromptsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    promptsToMigrateCount: state.promptsToMigrateCount,
    migratedPromptsCount: state.migratedPromptsCount,
  }),
);

// default name with counter
export const selectNewFolderName = createSelector(
  [
    selectFolders,
    (_state: RootState, folderId: string | undefined) => folderId,
  ],
  (folders, folderId) => {
    return getNextDefaultName(
      translate(DEFAULT_FOLDER_NAME),
      folders.filter((f) => f.folderId === folderId),
    );
  },
);

export const selectFailedMigratedPrompts = createSelector(
  [rootSelector],
  (state) => state.failedMigratedPrompts,
);

export const selectIsPromptRequestSent = createSelector(
  [rootSelector],
  (state) => state.isPromptRequestSent,
);
