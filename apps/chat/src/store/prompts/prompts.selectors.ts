import { createSelector } from '@reduxjs/toolkit';

import {
  isSearchFilterMatched,
  isSearchTermMatched,
  isSectionFilterMatched,
  isVersionFilterMatched,
} from '@/src/utils/app/common';
import {
  getChildAndCurrentFoldersById,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
  isFolderEmpty,
  sortByName,
  splitEntityId,
} from '@/src/utils/app/folders';
import { getPromptRootId, isRootId } from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import {
  PublishedWithMeFilter,
  doesEntityContainSearchTerm,
  getMyItemsFilters,
} from '@/src/utils/app/search';
import { translate } from '@/src/utils/app/translation';

import { Prompt } from '@/src/types/prompt';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import {
  DEFAULT_FOLDER_NAME,
  DEFAULT_PROMPT_NAME,
} from '@/src/constants/default-ui-settings';

import { RootState } from '../index';
import { PromptsState } from './prompts.types';

import { ShareEntity } from '@epam/ai-dial-shared';

const rootSelector = (state: RootState): PromptsState => state.prompts;

export const selectPrompts = (state: RootState) => rootSelector(state).prompts;

export const selectSearchTerm = (state: RootState) =>
  rootSelector(state).searchTerm;

export const selectFilteredPrompts = (
  filters: EntityFilters,
  searchTerm?: string,
  ignoreFilters?: Partial<{
    ignoreSectionFilter: boolean;
    ignoreVersionFilter: boolean;
  }>,
) =>
  createSelector(
    [
      selectPrompts,
      (state) => PublicationSelectors.selectPublicVersionGroups(state),
    ],
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

export const selectPrompt = createSelector(
  [selectPrompts, (_state, promptId: string) => promptId],
  (prompts, promptId) => {
    return prompts.find((prompt) => prompt.id === promptId);
  },
);

export const selectFolders = (state: RootState) => rootSelector(state).folders;

export const selectEmptyFolderIds = createSelector(
  [selectFolders, selectPrompts],
  (folders, prompts) => {
    return folders
      .filter(({ id }) => isFolderEmpty({ id, folders, entities: prompts }))
      .map(({ id }) => id);
  },
);

export const selectFilteredFolders = (
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

export const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);

export const selectRootParentFolder = createSelector(
  [
    (state, folderId: string | undefined) =>
      selectParentFolders(state, folderId),
  ],
  (parentFolders) => {
    return parentFolders.find((folder) => isRootId(folder.folderId));
  },
);

export const selectParentFoldersIds = createSelector(
  [selectParentFolders],
  (folders) => {
    return folders.map((folder) => folder.id);
  },
);

export const selectSearchFilters = (state: RootState) =>
  rootSelector(state).searchFilters;

export const selectIsEmptySearchFilter = (state: RootState) =>
  selectSearchFilters(state) === SearchFilters.None;

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
  [selectSelectedPrompt, selectFolders],
  (prompt, folders) => {
    if (!prompt) return [];

    return getParentAndCurrentFoldersById(folders, prompt.folderId).map(
      ({ id }) => id,
    );
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

export const selectTemporaryFolders = (state: RootState) =>
  rootSelector(state).temporaryFolders;

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

export const selectNewAddedFolderId = (state: RootState) =>
  rootSelector(state).newAddedFolderId;

export const selectLoadingFolderIds = (state: RootState) =>
  rootSelector(state).loadingFolderIds;

export const arePromptsUploaded = (state: RootState) =>
  rootSelector(state).promptsLoaded;

export const isPromptLoading = (state: RootState) =>
  rootSelector(state).isPromptLoading;

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

export const selectIsNewPromptCreating = (state: RootState) =>
  rootSelector(state).isNewPromptCreating;

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
  [selectFolders],
  (folders) => {
    return folders.filter((f) => f.isPublicationFolder);
  },
);

export const selectSelectedItems = (state: RootState) =>
  rootSelector(state).chosenPromptIds;

export const selectChosenEmptyFolderIds = (state: RootState) =>
  rootSelector(state).chosenEmptyFoldersIds;

export const selectIsSelectMode = createSelector(
  [selectSelectedItems, selectChosenEmptyFolderIds],
  (chosenPromptIds, chosenEmptyFoldersIds) => {
    return chosenPromptIds.length > 0 || chosenEmptyFoldersIds.length > 0;
  },
);

export const selectIsFolderEmpty = createSelector(
  [selectEmptyFolderIds, (_state, folderId: string) => folderId],
  (emptyFolderIds, folderId) => {
    return emptyFolderIds.includes(folderId);
  },
);

export const selectChosenFolderIds = (itemsShouldBeChosen: ShareEntity[]) =>
  createSelector(
    [
      selectSelectedItems,
      selectFolders,
      selectEmptyFolderIds,
      selectChosenEmptyFolderIds,
    ],
    (selectedItems, folders, emptyFolderIds, chosenEmptyFolderIds) => {
      const fullyChosenFolderIds = folders
        .map((folder) => `${folder.id}/`)
        .filter(
          (folderId) =>
            itemsShouldBeChosen.some((item) => item.id.startsWith(folderId)) ||
            chosenEmptyFolderIds.some((id) => id.startsWith(folderId)),
        )
        .filter(
          (folderId) =>
            itemsShouldBeChosen
              .filter((item) => item.id.startsWith(folderId))
              .every((item) => selectedItems.includes(item.id)) &&
            emptyFolderIds
              .filter((id) => id.startsWith(folderId))
              .every((id) => chosenEmptyFolderIds.includes(`${id}/`)),
        );

      const partialChosenFolderIds = folders
        .map((folder) => `${folder.id}/`)
        .filter(
          (folderId) =>
            !selectedItems.some((chosenId) => folderId.startsWith(chosenId)) &&
            (selectedItems.some((chosenId) => chosenId.startsWith(folderId)) ||
              fullyChosenFolderIds.some((entityId) =>
                entityId.startsWith(folderId),
              )) &&
            !fullyChosenFolderIds.includes(folderId),
        );

      return { fullyChosenFolderIds, partialChosenFolderIds };
    },
  );

export const selectInitialized = (state: RootState) =>
  rootSelector(state).initialized;

export const selectPromptWithVariablesForApply = (state: RootState) =>
  rootSelector(state).promptWithVariablesForApply;
