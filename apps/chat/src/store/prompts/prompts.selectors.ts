import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersById,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
  sortByName,
  splitEntityId,
} from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import {
  PublishedWithMeFilter,
  doesEntityContainSearchTerm,
  getMyItemsFilters,
} from '@/src/utils/app/search';
import { isEntityExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { ShareEntity } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import {
  DEFAULT_FOLDER_NAME,
  DEFAULT_PROMPT_NAME,
} from '@/src/constants/default-ui-settings';

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
    (_state, _filters, _searchTerm?: string, ignoreSectionFilter?: boolean) =>
      ignoreSectionFilter,
  ],
  (prompts, filters, searchTerm?, ignoreSectionFilter?) => {
    return prompts.filter(
      (prompt) =>
        (!searchTerm || doesEntityContainSearchTerm(prompt, searchTerm)) &&
        (filters.searchFilter?.(prompt) ?? true) &&
        (ignoreSectionFilter || (filters.sectionFilter?.(prompt) ?? true)),
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
      entities: selectFilteredPrompts(state, filters, searchTerm, true),
      searchTerm,
      includeEmptyFolders,
    }),
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
      doesEntityContainSearchTerm(prompt, searchTerm),
    );
  },
);

export const selectIsEditModalOpen = createSelector([rootSelector], (state) => {
  return {
    showModal: state.isEditModalOpen,
    isModalPreviewMode: state.isModalPreviewMode,
  };
});

export const selectSelectedPromptId = createSelector(
  [rootSelector],
  (state) => {
    return {
      selectedPromptId: state.selectedPromptId,
      isSelectedPromptApproveRequiredResource:
        state.isSelectedPromptApproveRequiredResource,
    };
  },
);

export const selectSelectedPrompt = createSelector(
  [selectPrompts, selectSelectedPromptId],
  (prompts, { selectedPromptId }): Prompt | undefined => {
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
    if (!folderId.startsWith(getPromptRootId())) {
      return true;
    }
    const parentFolders = getParentAndCurrentFoldersById(folders, folderId);
    return parentFolders.some((folder) => isEntityExternal(folder));
  },
);

export const selectDoesAnyMyItemExist = createSelector(
  [selectFolders, selectPrompts],
  (folders, prompts) => {
    const promptRootId = getPromptRootId();
    return (
      prompts.some((prompt) => prompt.id.startsWith(promptRootId)) ||
      folders.some((folder) => folder.id.startsWith(promptRootId))
    );
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
    return folders.filter(
      (folder) => PublishedWithMeFilter.sectionFilter?.(folder) ?? true,
    );
  },
);

export const selectTemporaryAndPublishedFolders = createSelector(
  [
    selectFolders,
    selectPublishedWithMeFolders,
    selectTemporaryFolders,
    (_state, searchTerm?: string) => searchTerm,
  ],
  (allFolders, publishedFolders, temporaryFolders, searchTerm = '') => {
    const allPublishedFolders = publishedFolders.flatMap((folder) =>
      getChildAndCurrentFoldersById(folder.id, allFolders),
    );
    const filteredFolders = [
      ...sortByName(allPublishedFolders),
      ...temporaryFolders,
    ].filter((folder) => doesEntityContainSearchTerm(folder, searchTerm));

    return getParentAndChildFolders(
      sortByName([...allFolders, ...temporaryFolders]),
      filteredFolders,
    );
  },
);

export const selectNewAddedFolderId = createSelector(
  [rootSelector],
  (state) => {
    return state.newAddedFolderId;
  },
);
export const selectLoadingFolderIds = createSelector(
  [rootSelector],
  (state) => {
    return state.loadingFolderIds;
  },
);

export const arePromptsUploaded = createSelector([rootSelector], (state) => {
  return state.promptsLoaded;
});

export const isPromptLoading = createSelector([rootSelector], (state) => {
  return state.isPromptLoading;
});

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

export const selectIsNewPromptCreating = createSelector(
  [rootSelector],
  (state) => state.isNewPromptCreating,
);

export const getNewPrompt = createSelector([selectPrompts], (prompts) => {
  const promptRootId = getPromptRootId();
  return regeneratePromptId({
    name: getNextDefaultName(
      DEFAULT_PROMPT_NAME,
      prompts.filter((prompt) => prompt.folderId === promptRootId), // only my root prompts
    ),
    description: '',
    content: '',
    folderId: promptRootId,
  });
});

export const selectSelectedOrNewPrompt = createSelector(
  [selectIsNewPromptCreating, (state: RootState) => state],
  (isNewPromptCreating: boolean, state: RootState) => {
    return isNewPromptCreating
      ? getNewPrompt(state)
      : selectSelectedPrompt(state);
  },
);

export const selectDuplicatedPrompt = createSelector(
  [
    selectPrompts,
    (
      _state: RootState,
      { importId, promptName }: { importId: string; promptName: string },
    ) => ({ importId, promptName }),
  ],
  (conversations, { importId, promptName }) => {
    return conversations.find((conversation) => {
      const { parentPath } = splitEntityId(conversation.id);
      const { parentPath: importParentPath } = splitEntityId(importId);

      return (
        parentPath === importParentPath && conversation.name === promptName
      );
    });
  },
);

export const selectPublicationFolders = createSelector(
  [rootSelector],
  (state: PromptsState) => {
    return state.folders.filter((f) => f.isPublicationFolder);
  },
);

export const selectIsSelectMode = createSelector([rootSelector], (state) => {
  return state.chosenPromptIds.length > 0;
});

export const selectSelectedItems = createSelector([rootSelector], (state) => {
  return state.chosenPromptIds;
});

export const selectPartialChosenFolderIds = createSelector(
  [selectSelectedItems, selectFolders],
  (selectedItems, promptFolders) => {
    return promptFolders
      .map((folder) => `${folder.id}/`)
      .filter(
        (folderId) =>
          !selectedItems.some((chosenId) => folderId.startsWith(chosenId)) &&
          (selectedItems.some((chosenId) => chosenId.startsWith(folderId)) ||
            selectedItems.some((entityId) => entityId.startsWith(folderId))),
      );
  },
);

export const selectChosenFolderIds = createSelector(
  [
    selectSelectedItems,
    selectFolders,
    (_state, itemsShouldBeChosen: ShareEntity[]) => itemsShouldBeChosen,
  ],
  (selectedItems, folders, itemsShouldBeChosen) => {
    return folders
      .map((folder) => `${folder.id}/`)
      .filter((folderId) =>
        itemsShouldBeChosen.some((item) => item.id.startsWith(folderId)),
      )
      .filter((folderId) =>
        itemsShouldBeChosen
          .filter((item) => item.id.startsWith(folderId))
          .every((item) => selectedItems.includes(item.id)),
      );
  },
);
