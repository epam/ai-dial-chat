import { createSelector } from '@reduxjs/toolkit';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
  isSearchFilterMatched,
  isSectionFilterMatched,
  isVersionFilterMatched,
} from '@/src/utils/app/common';
import {
  isPlaybackConversation,
  isReplayConversation,
  sortByDateAndName,
} from '@/src/utils/app/conversation';
import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersById,
  getChildAndCurrentFoldersIdsById,
  getConversationAttachmentWithPath,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
  getParentFolderIdsFromEntityId,
  isFolderEmpty,
  sortByName,
} from '@/src/utils/app/folders';
import {
  isConversationWithFormSchema,
  isMessageInputDisabled,
} from '@/src/utils/app/form-schema';
import {
  getConversationRootId,
  isEntityIdExternal,
  isEntityIdLocal,
  isRootId,
} from '@/src/utils/app/id';
import { isEntityReadOnly } from '@/src/utils/app/permissions';
import { getEntitiesFromTemplateMapping } from '@/src/utils/app/prompts';
import {
  PublishedWithMeFilter,
  doesEntityContainSearchTerm,
  getMyItemsFilters,
  isSearchTermMatched,
} from '@/src/utils/app/search';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';

import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { DialAIEntityModel } from '@/src/types/models';
import { EntityFilter, EntityFilters, SearchFilters } from '@/src/types/search';
import { RootState } from '@/src/types/store';

import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import {
  ConversationInfo,
  Feature,
  Role,
  ShareEntity,
} from '@epam/ai-dial-shared';
import cloneDeep from 'lodash-es/cloneDeep';
import isNil from 'lodash-es/isNil';
import uniqBy from 'lodash-es/uniqBy';

const rootSelector = (state: RootState) => state.conversations;

const selectConversations = (state: RootState): ConversationInfo[] =>
  rootSelector(state).conversations;

const selectNotExternalConversations = createSelector(
  [selectConversations],
  (conversations) =>
    conversations.filter(
      (conversation) =>
        !isEntityIdExternal(conversation) && !isEntityIdLocal(conversation),
    ),
);

const selectConversationsByFolderId = createSelector(
  [selectConversations, (_state, folderId: string) => folderId],
  (conversations, folderId) => {
    const folderPath = `${folderId}/`;
    return conversations.filter((conversation) =>
      conversation.id.startsWith(folderPath),
    );
  },
);

const selectFilteredConversations = (
  filters: EntityFilters,
  searchTerm?: string,
  ignoreFilters?: Partial<{
    ignoreSectionFilter: boolean;
    ignoreVersionFilter: boolean;
  }>,
) =>
  createSelector(
    [selectConversations, PublicationSelectors.selectPublicVersionGroups],
    (conversations, versionGroups) => {
      return conversations.filter(
        (conversation) =>
          isSearchTermMatched(conversation, searchTerm) &&
          isSearchFilterMatched(conversation, filters) &&
          isSectionFilterMatched(
            conversation,
            filters,
            ignoreFilters?.ignoreSectionFilter,
          ) &&
          isVersionFilterMatched(
            conversation,
            filters,
            versionGroups,
            ignoreFilters?.ignoreVersionFilter,
          ),
      );
    },
  );

const selectFolders = (state: RootState) => rootSelector(state).folders;

const selectMyFolders = createSelector([selectFolders], (folders) => {
  return folders.filter((folder) =>
    folder.id.startsWith(`${getConversationRootId()}/`),
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
  [selectFolders, selectConversations],
  (folders, conversations) => {
    return folders
      .filter(({ id }) =>
        isFolderEmpty({ id, folders, entities: conversations }),
      )
      .map(({ id }) => id);
  },
);
const ignoreFilters = {
  ignoreSectionFilter: true,
  ignoreVersionFilter: true,
};
const selectFilteredFolders = (
  filters: EntityFilters,
  searchTerm?: string,
  includeEmptyFolders?: boolean,
) =>
  createSelector(
    [
      selectFolders,
      selectEmptyFolderIds,
      selectFilteredConversations(filters, searchTerm, ignoreFilters),
    ],
    (allFolders, emptyFolderIds, filteredConversations) =>
      getFilteredFolders({
        allFolders,
        emptyFolderIds,
        filters,
        entities: filteredConversations,
        searchTerm,
        includeEmptyFolders,
      }),
  );

const selectLastConversation = createSelector(
  [selectNotExternalConversations],
  (ownConversations): ConversationInfo | undefined => {
    if (!ownConversations.length) return undefined;
    return sortByDateAndName(ownConversations)[0];
  },
);
const selectConversation = createSelector(
  [selectConversations, (_state, id: string) => id],
  (conversations, id): ConversationInfo | undefined => {
    return conversations.find((conv) => conv.id === id);
  },
);

const selectSelectedConversationsIds = (state: RootState) =>
  rootSelector(state).selectedConversationsIds;

const selectConversationSignal = (state: RootState) =>
  rootSelector(state).conversationSignal;

const selectSelectedConversations = createSelector(
  [selectConversations, selectSelectedConversationsIds],
  (conversations, selectedConversationIds) => {
    return selectedConversationIds
      .map((id) => conversations.find((conv) => conv.id === id))
      .filter(Boolean) as Conversation[];
  },
);

const _selectLoadedCharts = (state: RootState) =>
  rootSelector(state).loadedCharts;

const selectLoadedCharts = createSelector(
  [_selectLoadedCharts],
  (loadedCharts) => {
    // cloneDeep because of Plot component doesn't work with redux-toolkit maintained state slices which disallow, or guard, against state mutations.
    // PlotReactState had some additional "state" properties that were never declared or updated.
    return cloneDeep(loadedCharts);
  },
);

const selectChartLoading = (state: RootState) =>
  rootSelector(state).chartLoading;

const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);

const selectRootParentFolder = createSelector(
  [
    (state, folderId: string | undefined) =>
      selectParentFolders(state, folderId),
  ],
  (parentFolders) => {
    return parentFolders.find((folder) => isRootId(folder.folderId));
  },
);

const selectSelectedConversationsFoldersIds = createSelector(
  [selectSelectedConversationsIds],
  (selectedConversationsIds) => {
    return selectedConversationsIds.flatMap((id) =>
      getParentFolderIdsFromEntityId(id),
    );
  },
);

const selectFirstSelectedConversation = (
  state: RootState,
): Conversation | undefined => selectSelectedConversations(state)[0];

const selectIsConversationsStreaming = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => !!conv.isMessageStreaming);
  },
);

const selectIsConversationNameInvalid = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => isEntityNameInvalid(conv.name));
  },
);

const selectIsConversationPathInvalid = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => hasInvalidNameInPath(conv.folderId));
  },
);

const selectSearchTerm = (state: RootState) => rootSelector(state).searchTerm;

const selectSearchFilters = (state: RootState) =>
  rootSelector(state).searchFilters;

const selectIsEmptySearchFilter = (state: RootState) =>
  selectSearchFilters(state) === SearchFilters.None;

const selectMyItemsFilters = createSelector(
  [selectSearchFilters],
  (searchFilters) => getMyItemsFilters(searchFilters),
);

const selectIsReplayPaused = (state: RootState) =>
  rootSelector(state).isReplayPaused;

const selectIsReplayRequiresVariables = (state: RootState) =>
  rootSelector(state).isReplayRequiresVariables;

const selectWillReplayRequireVariables = createSelector(
  [selectFirstSelectedConversation],
  (conversation) => {
    if (!conversation?.replay) return false;
    const replay = conversation.replay;
    return (
      getEntitiesFromTemplateMapping(
        replay.replayUserMessagesStack?.[replay.activeReplayIndex ?? 0]
          ?.templateMapping,
      ).length > 0
    );
  },
);

const selectIsReplaySelectedConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => isReplayConversation(conv));
  },
);

const selectIsPlaybackSelectedConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => isPlaybackConversation(conv));
  },
);

const selectAreSelectedConversationsExternal = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => isEntityIdExternal(conv));
  },
);

const selectAreSelectedConversationsReadOnly = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some(
      (conv) => isEntityReadOnly(conv) && isEntityIdExternal(conv),
    );
  },
);

const selectDoesAnyMyItemExist = createSelector(
  [selectFolders, selectConversations],
  (folders, conversations) => {
    const conversationRootId = `${getConversationRootId()}/`;
    return (
      conversations.some((conv) => conv.id.startsWith(conversationRootId)) ||
      folders.some((folder) => folder.id.startsWith(conversationRootId))
    );
  },
);

const selectPlaybackActiveIndex = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return (
      conversations[0].playback && conversations[0].playback.activePlaybackIndex
    );
  },
);

const selectIsErrorReplayConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => conv.replay?.isError);
  },
);

const selectIsPlaybackPaused = (state: RootState) =>
  rootSelector(state).isPlaybackPaused;

const selectIsMessagesError = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) =>
      conv.messages.some((message) => !isNil(message.errorMessage)),
    );
  },
);

const selectIsLastAssistantMessageEmpty = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => {
      if (conv.messages.length === 0) {
        return false;
      }

      const lastMessageIndex = conv.messages.length - 1;
      const lastMessage = conv.messages[lastMessageIndex];

      return (
        lastMessage.role === Role.Assistant &&
        !lastMessage.content.length &&
        !lastMessage.custom_content?.attachments?.length &&
        !lastMessage.custom_content?.stages?.length
      );
    });
  },
);

const selectSelectedConversationsModels = createSelector(
  [selectSelectedConversations, ModelsSelectors.selectModelsMap],
  (conversations, modelsMap) => {
    return conversations
      .map((conv) => modelsMap[conv.model.id])
      .filter(Boolean) as DialAIEntityModel[];
  },
);

const selectAvailableAttachmentsTypes = createSelector(
  [selectSelectedConversationsModels],
  (models) => {
    if (models.length === 0) {
      return [];
    }

    const modelsAttachmentsTypes = models
      .map((model) => model?.inputAttachmentTypes || [])
      .filter(Boolean) as string[][];

    if (modelsAttachmentsTypes.length === 1) {
      return modelsAttachmentsTypes[0];
    }

    // Assume that we have only 2 selected models available
    const availableModelsAttachmentTypes = (
      modelsAttachmentsTypes[0] || []
    ).filter((value) => (modelsAttachmentsTypes[1] ?? []).includes(value));

    return availableModelsAttachmentTypes.length === 0
      ? undefined
      : availableModelsAttachmentTypes;
  },
);

const selectMaximumAttachmentsAmount = createSelector(
  [selectSelectedConversationsModels],
  (models) => {
    if (models.length === 0) {
      return 0;
    }

    return Math.min(
      ...models.map(
        (model) => model?.maxInputAttachments ?? Number.MAX_SAFE_INTEGER,
      ),
    );
  },
);

const selectCanAttachLink = createSelector(
  [SettingsSelectors.selectEnabledFeatures, selectSelectedConversationsModels],
  (enabledFeatures, models) => {
    const inputLinksEnabled = enabledFeatures.has(Feature.InputLinks);
    if (!inputLinksEnabled || models.length === 0) {
      return false;
    }

    return models.every((model) => model?.features?.urlAttachments);
  },
);

const selectIsStartedCustomViewerConversation = (state: RootState) =>
  rootSelector(state).isStartedCustomViewerConversation;

const selectCanAttachFolders = createSelector(
  [selectSelectedConversationsModels],
  (models) => {
    if (models.length === 0) {
      return false;
    }

    return models.every((model) => model?.features?.folderAttachments);
  },
);

const selectCanAttachFile = createSelector(
  [SettingsSelectors.selectEnabledFeatures, selectSelectedConversationsModels],
  (enabledFeatures, models) => {
    const inputFilesEnabled = enabledFeatures.has(Feature.InputFiles);
    if (!inputFilesEnabled || models.length === 0) {
      return false;
    }

    return (
      Math.min(
        ...models.map((model) => model?.inputAttachmentTypes?.length ?? 0),
      ) > 0
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
      (folder) => PublishedWithMeFilter.sectionFilter?.(folder) ?? folder,
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

const getUniqueAttachments = (attachments: DialFile[]): DialFile[] =>
  uniqBy(attachments, (file) => constructPath(file.relativePath, file.name));

const getAttachments = createSelector(
  [
    selectFolders,
    selectConversations,
    (state: RootState, entityId: string) => selectConversation(state, entityId),
    (_state: RootState, entityId: string) => entityId,
    (
      _state: RootState,
      _entityId: string,
      entityFilter?: EntityFilter<ConversationInfo>,
    ) => entityFilter,
  ],
  (folders, conversations, conversation, entityId, entityFilter?) => {
    const conversationFilter = entityFilter || (() => true);

    if (conversation) {
      if (!conversationFilter(conversation)) return [];

      return getUniqueAttachments(
        getConversationAttachmentWithPath(conversation, folders),
      );
    }

    const folderIds = new Set(
      getChildAndCurrentFoldersIdsById(entityId, folders),
    );

    if (!folderIds.size) return [];

    const filteredConversations = conversations.filter(
      (conv) =>
        conv.folderId &&
        folderIds.has(conv.folderId) &&
        conversationFilter(conv),
    );

    return getUniqueAttachments(
      filteredConversations.flatMap((conv) =>
        getConversationAttachmentWithPath(conv, folders),
      ),
    );
  },
);

const areConversationsUploaded = (state: RootState) =>
  rootSelector(state).conversationsLoaded;

const selectAreSelectedConversationsLoaded = (state: RootState) =>
  rootSelector(state).areSelectedConversationsLoaded;

const selectAreConversationsWithContentUploading = (state: RootState) =>
  rootSelector(state).areConversationsWithContentUploading;

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

const selectLoadingFolderIds = (state: RootState) =>
  rootSelector(state).loadingFolderIds;

const selectIsCompareLoading = (state: RootState) =>
  rootSelector(state).compareLoading;

const selectDuplicatedConversation = createSelector(
  [
    selectConversations,
    (
      _state: RootState,
      {
        importId,
        conversationName,
      }: { importId: string; conversationName: string },
    ) => ({ importId, conversationName }),
  ],
  (conversations, { importId, conversationName }) => {
    return conversations.find((conversation) => {
      const { parentPath } = splitEntityId(conversation.id);
      const { parentPath: importParentPath } = splitEntityId(importId);

      return (
        parentPath === importParentPath &&
        conversation.name === conversationName
      );
    });
  },
);

const selectCustomAttachmentLoading = (state: RootState) =>
  rootSelector(state).customAttachmentDataLoading;

const selectLoadedCustomAttachments = (state: RootState) =>
  rootSelector(state).loadedCustomAttachmentsData;

const selectCustomAttachmentData = createSelector(
  [
    selectLoadedCustomAttachments,
    (_state: RootState, attachmentUrl: string) => attachmentUrl,
  ],
  (loadedCustomAttachment, attachmentUrl) => {
    return attachmentUrl
      ? loadedCustomAttachment.find((loadedData) =>
          loadedData.url.endsWith(attachmentUrl),
        )?.data
      : undefined;
  },
);

const selectIsSelectMode = createSelector([rootSelector], (state) => {
  return (
    state.chosenConversationIds.length > 0 ||
    state.chosenEmptyFoldersIds.length > 0
  );
});

const selectSelectedItems = (state: RootState) =>
  rootSelector(state).chosenConversationIds;

const selectChosenEmptyFolderIds = (state: RootState) =>
  rootSelector(state).chosenEmptyFoldersIds;

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

const selectIsNewConversationUpdating = (state: RootState) =>
  rootSelector(state).isNewConversationUpdating;

const selectInitialized = (state: RootState) => rootSelector(state).initialized;

const selectRenamingConversationId = (state: RootState) =>
  rootSelector(state).renamingConversationId;

const selectRenamingConversation = createSelector(
  [selectConversations, selectRenamingConversationId],
  (conversations, renamingConversationId) =>
    conversations.find((conv) => conv.id === renamingConversationId),
);

const selectTalkToConversationId = (state: RootState) =>
  rootSelector(state).talkToConversationId;

const selectIsSelectedConversationBlocksInput = createSelector(
  [
    selectSelectedConversations,
    PublicationSelectors.selectResourcesToReview,
    ChatSelectors.selectIsConfigurationBlocksInput,
    ChatSelectors.selectNotAvailableEntityType,
    selectAreSelectedConversationsReadOnly,
  ],
  (
    conversations,
    resourcesToReview,
    isConfigurationBlocksInput,
    notAvailableEntityType,
    areReadOnly,
  ) => {
    const isReviewEntity = conversations.some((conversation) =>
      resourcesToReview.some(
        (resource) => resource.reviewUrl === conversation.id,
      ),
    );

    return conversations.some(
      (conversation) =>
        conversation.sharedWithMe ||
        (!conversation.messages?.length &&
          (isConfigurationBlocksInput || isReplayConversation(conversation))) ||
        notAvailableEntityType ||
        isPlaybackConversation(conversation) ||
        (areReadOnly && !isReviewEntity) ||
        !conversation.messages ||
        isMessageInputDisabled(
          conversation.messages.length,
          conversation.messages,
        ),
    );
  },
);

const selectPreviewConversationId = (state: RootState) =>
  rootSelector(state).previewConversationId;

const selectIsSelectedConversationsWithSchema = createSelector(
  [selectSelectedConversations],
  (conversations) => conversations.some(isConversationWithFormSchema),
);

const selectAction = (state: RootState) =>
  rootSelector(state).preselectedAction;

export const ConversationsSelectors = {
  selectConversations,
  selectConversationsByFolderId,
  selectFilteredConversations,
  selectFolders,
  selectMyFolders,
  selectMyFoldersWithSearchTerm,
  selectFolderById,
  selectFoldersByFolderId,
  selectEmptyFolderIds,
  selectFilteredFolders,
  selectLastConversation,
  selectConversation,
  selectSelectedConversationsIds,
  selectSelectedConversations,
  selectLoadedCharts,
  selectChartLoading,
  selectParentFolders,
  selectRootParentFolder,
  selectSelectedConversationsFoldersIds,
  selectFirstSelectedConversation,
  selectIsConversationsStreaming,
  selectIsConversationNameInvalid,
  selectIsConversationPathInvalid,
  selectSearchTerm,
  selectSearchFilters,
  selectIsEmptySearchFilter,
  selectMyItemsFilters,
  selectIsReplayPaused,
  selectIsReplayRequiresVariables,
  selectWillReplayRequireVariables,
  selectIsReplaySelectedConversations,
  selectIsPlaybackSelectedConversations,
  selectAreSelectedConversationsExternal,
  selectAreSelectedConversationsReadOnly,
  selectDoesAnyMyItemExist,
  selectPlaybackActiveIndex,
  selectIsErrorReplayConversations,
  selectIsPlaybackPaused,
  selectIsMessagesError,
  selectIsLastAssistantMessageEmpty,
  selectSelectedConversationsModels,
  selectAvailableAttachmentsTypes,
  selectMaximumAttachmentsAmount,
  selectCanAttachLink,
  selectIsStartedCustomViewerConversation,
  selectCanAttachFolders,
  selectCanAttachFile,
  selectTemporaryFolders,
  selectTemporaryFoldersWithSearchTerm,
  selectTemporaryAndPublishedFolders,
  selectNewAddedFolderId,
  selectLoadingFolderIds,
  selectIsCompareLoading,
  selectDuplicatedConversation,
  selectCustomAttachmentLoading,
  selectCustomAttachmentData,
  selectIsSelectMode,
  selectSelectedItems,
  selectChosenFolderIds,
  selectIsFolderEmpty,
  selectIsNewConversationUpdating,
  selectInitialized,
  selectRenamingConversation,
  selectTalkToConversationId,
  selectIsSelectedConversationBlocksInput,
  selectPreviewConversationId,
  selectIsSelectedConversationsWithSchema,
  selectAreSelectedConversationsLoaded,
  selectNewFolderName,
  areConversationsUploaded,
  selectAreConversationsWithContentUploading,
  getAttachments,
  selectConversationSignal,
  getUniqueAttachments,
  selectAction,
};
