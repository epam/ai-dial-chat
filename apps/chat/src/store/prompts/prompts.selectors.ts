import { createSelector } from '@reduxjs/toolkit';

import {
  isSearchFilterMatched,
  isSectionFilterMatched,
  isVersionFilterMatched,
} from '@/src/utils/app/common';
import {
  getChildAndCurrentFoldersById,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
  getPartialAndFullyChosenFolders,
  isFolderEmpty,
  sortByName,
} from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import {
  PublishedWithMeFilter,
  doesEntityContainSearchTerm,
  getMyItemsFilters,
  isSearchTermMatched,
} from '@/src/utils/app/search';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';

import { Prompt } from '@/src/types/prompt';
import { EntityFilters, SearchFilters } from '@/src/types/search';
import { RootState } from '@/src/types/store';

import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import {
  DEFAULT_FOLDER_NAME,
  DEFAULT_PROMPT_NAME,
} from '@/src/constants/default-ui-settings';

import { ShareEntity } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState) => state.prompts;

const selectPrompts = (state: RootState) => rootSelector(state).prompts;

const selectSearchTerm = (state: RootState) => rootSelector(state).searchTerm;

const selectFilteredPrompts = (
  filters: EntityFilters,
  searchTerm?: string,
  ignoreFilters?: Partial<{
    ignoreSectionFilter: boolean;
    ignoreVersionFilter: boolean;
  }>,
) =>
  createSelector(
    [selectPrompts, PublicationSelectors.selectPublicVersionGroups],
    (prompts, versionGroups) => {
      return prompts.filter(
        (prompt) =>
          isSearchTermMatched(prompt, searchTerm) &&
          isSearchFilterMatched(prompt, filters) &&
          isSectionFilterMatched(
            prompt,
            filters,
            ignoreFilters?.ignoreSectionFilter,
          ) &&
          isVersionFilterMatched(
            prompt,
            filters,
            versionGroups,
            ignoreFilters?.ignoreVersionFilter,
          ),
      );
    },
  );

const selectPrompt = createSelector(
  [selectPrompts, (_state, promptId: string) => promptId],
  (prompts, promptId) => {
    return prompts.find((prompt) => prompt.id === promptId);
  },
);

const selectFolders = (state: RootState) => rootSelector(state).folders;

const selectMyFolders = createSelector([selectFolders], (folders) => {
  return folders.filter((folder) =>
    folder.id.startsWith(`${getPromptRootId()}/`),
  );
});

const selectMyFoldersWithSearchTerm = createSelector(
  [selectMyFolders, (_state, searchTerm: string) => searchTerm],
  (folders, searchTerm) => {
    const filtered = folders.filter((folder) =>
      doesEntityContainSearchTerm(folder, searchTerm),
    );

    return getParentAndChildFolders(folders, filtered);
  },
);

const selectFolderById = createSelector(
  [selectFolders, (_state, id: string) => id],
  (folders, id) => {
    return folders.find((folder) => folder.id === id);
  },
);

const selectFoldersByFolderId = createSelector(
  [selectFolders, (_state, folderId: string) => folderId],
  (folders, folderId) => {
    const folderPath = `${folderId}/`;

    return folders.filter((folder) => folder.id.startsWith(folderPath));
  },
);

const selectEmptyFolderIds = createSelector(
  [selectFolders, selectPrompts],
  (folders, prompts) => {
    return folders
      .filter(({ id }) => isFolderEmpty({ id, folders, entities: prompts }))
      .map(({ id }) => id);
  },
);

const selectFilteredFolders = (
  filters: EntityFilters,
  searchTerm?: string,
  includeEmptyFolders?: boolean,
) =>
  createSelector(
    [
      selectFolders,
      selectEmptyFolderIds,
      selectFilteredPrompts(filters, searchTerm, {
        ignoreSectionFilter: true,
        ignoreVersionFilter: true,
      }),
    ],
    (allFolders, emptyFolderIds, filteredPrompts) =>
      getFilteredFolders({
        allFolders,
        emptyFolderIds,
        filters,
        entities: filteredPrompts,
        searchTerm,
        includeEmptyFolders,
      }),
  );

const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);

const selectPromptsByFolderId = createSelector(
  [selectPrompts, (_state, folderId: string) => folderId],
  (prompts, folderId) => {
    const folderPath = `${folderId}/`;
    return prompts.filter((prompt) => prompt.id.startsWith(folderPath));
  },
);

const selectSearchFilters = (state: RootState) =>
  rootSelector(state).searchFilters;

const selectIsEmptySearchFilter = (state: RootState) =>
  selectSearchFilters(state) === SearchFilters.None;

const selectMyItemsFilters = createSelector(
  [selectSearchFilters],
  (searchFilters) => getMyItemsFilters(searchFilters),
);

const selectIsPromptModalOpen = (state: RootState) =>
  rootSelector(state).isPromptModalOpen;

const selectIsPromptModalInitModelEdit = (state: RootState) =>
  rootSelector(state).isPromptModalInitModeEdit;

const selectSelectedPromptId = createSelector([rootSelector], (state) => {
  return {
    selectedPromptId: state.selectedPromptId,
    isSelectedPromptApproveRequiredResource:
      state.isSelectedPromptApproveRequiredResource,
  };
});

const selectSelectedPrompt = createSelector(
  [selectPrompts, selectSelectedPromptId],
  (prompts, { selectedPromptId }): Prompt | undefined => {
    if (!selectedPromptId) {
      return undefined;
    }

    return prompts.find((prompt) => prompt.id === selectedPromptId) as Prompt;
  },
);

const selectSelectedPromptFoldersIds = createSelector(
  [selectSelectedPrompt, selectFolders],
  (prompt, folders) => {
    if (!prompt) return [];

    return getParentAndCurrentFoldersById(folders, prompt.folderId).map(
      ({ id }) => id,
    );
  },
);

const selectDoesAnyMyItemExist = createSelector(
  [selectFolders, selectPrompts],
  (folders, prompts) => {
    const promptRootId = `${getPromptRootId()}/`;
    return (
      prompts.some((prompt) => prompt.id.startsWith(promptRootId)) ||
      folders.some((folder) => folder.id.startsWith(promptRootId))
    );
  },
);

const selectTemporaryFolders = (state: RootState) =>
  rootSelector(state).temporaryFolders;

const selectTemporaryFoldersWithSearchTerm = createSelector(
  [selectTemporaryFolders, (_state, searchTerm: string) => searchTerm],
  (folders, searchTerm) => {
    const filtered = folders.filter((folder) =>
      doesEntityContainSearchTerm(folder, searchTerm),
    );

    return getParentAndChildFolders(folders, filtered);
  },
);

const selectPublishedWithMeFolders = createSelector(
  [selectFolders],
  (folders) => {
    return folders.filter(
      (folder) => PublishedWithMeFilter.sectionFilter?.(folder) ?? true,
    );
  },
);

const selectTemporaryAndPublishedFolders = createSelector(
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

const selectNewAddedFolderId = (state: RootState) =>
  rootSelector(state).newAddedFolderId;

const selectLoadingFolderIds = (state: RootState) =>
  rootSelector(state).loadingFolderIds;

const arePromptsUploaded = (state: RootState) =>
  rootSelector(state).promptsLoaded;

const isPromptLoading = (state: RootState) =>
  rootSelector(state).isPromptLoading;

// default name with counter
const selectNewFolderName = createSelector(
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

const selectIsNewPromptCreating = (state: RootState) =>
  rootSelector(state).isNewPromptCreating;

const getNewPrompt = createSelector([selectPrompts], (prompts) => {
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

const selectSelectedOrNewPrompt = createSelector(
  [selectIsNewPromptCreating, (state: RootState) => state],
  (isNewPromptCreating: boolean, state: RootState) => {
    return isNewPromptCreating
      ? getNewPrompt(state)
      : selectSelectedPrompt(state);
  },
);

const selectDuplicatedPrompt = createSelector(
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

const selectSelectedItems = (state: RootState) =>
  rootSelector(state).chosenPromptIds;

const selectChosenEmptyFolderIds = (state: RootState) =>
  rootSelector(state).chosenEmptyFoldersIds;

const selectIsSelectMode = createSelector(
  [selectSelectedItems, selectChosenEmptyFolderIds],
  (chosenPromptIds, chosenEmptyFoldersIds) => {
    return chosenPromptIds.length > 0 || chosenEmptyFoldersIds.length > 0;
  },
);

const selectIsFolderEmpty = createSelector(
  [selectEmptyFolderIds, (_state, folderId: string) => folderId],
  (emptyFolderIds, folderId) => {
    return emptyFolderIds.includes(folderId);
  },
);

const selectChosenFolderIds = (itemsShouldBeChosen: ShareEntity[]) =>
  createSelector(
    [
      selectSelectedItems,
      selectFolders,
      selectEmptyFolderIds,
      selectChosenEmptyFolderIds,
    ],
    (selectedItems, folders, emptyFolderIds, chosenEmptyFolderIds) => {
      return getPartialAndFullyChosenFolders(
        folders,
        itemsShouldBeChosen,
        selectedItems,
        emptyFolderIds,
        chosenEmptyFolderIds,
      );
    },
  );

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectPromptWithVariablesForApply = (state: RootState) =>
  rootSelector(state).promptWithVariablesForApply;

const selectDeletingPrompt = (state: RootState) =>
  rootSelector(state).deletingPrompt;

const selectMoveToPrompt = (state: RootState) =>
  rootSelector(state).moveToPrompt;

export const PromptsSelectors = {
  selectPrompts,
  selectSearchTerm,
  selectFilteredPrompts,
  selectPrompt,
  selectFolders,
  selectMyFolders,
  selectMyFoldersWithSearchTerm,
  selectFolderById,
  selectFoldersByFolderId,
  selectEmptyFolderIds,
  selectFilteredFolders,
  selectParentFolders,
  selectPromptsByFolderId,
  selectSearchFilters,
  selectMyItemsFilters,
  selectIsEmptySearchFilter,
  selectDoesAnyMyItemExist,
  selectTemporaryFolders,
  selectTemporaryFoldersWithSearchTerm,
  selectTemporaryAndPublishedFolders,
  selectNewAddedFolderId,
  selectLoadingFolderIds,
  arePromptsUploaded,
  isPromptLoading,
  selectNewFolderName,
  selectIsNewPromptCreating,
  selectSelectedPrompt,
  selectSelectedPromptFoldersIds,
  selectSelectedOrNewPrompt,
  selectDuplicatedPrompt,
  selectSelectedItems,
  selectIsSelectMode,
  selectChosenFolderIds,
  selectIsPromptModalOpen,
  selectIsPromptModalInitModelEdit,
  selectSelectedPromptId,
  selectIsFolderEmpty,
  selectInitialized,
  selectPromptWithVariablesForApply,
  selectDeletingPrompt,
  selectMoveToPrompt,
};
