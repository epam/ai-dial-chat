import { createSelector } from '@reduxjs/toolkit';

import { sortByDateAndName } from '@/src/utils/app/conversation';
import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getConversationAttachmentWithPath,
  getFilteredFolders,
  getNextDefaultName,
  getParentAndChildFolders,
  getParentAndCurrentFoldersById,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';
import { getConversationRootId } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  doesPromptOrConversationContainSearchTerm,
  getMyItemsFilters,
} from '@/src/utils/app/search';
import {
  isEntityExternal,
  isEntityOrParentsExternal,
} from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { Conversation, ConversationInfo, Role } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import { RootState } from '../index';
import { ModelsSelectors } from '../models/models.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { ConversationsState } from './conversations.types';

import { Feature } from '@epam/ai-dial-shared';
import { cloneDeep } from 'lodash-es';
import uniqBy from 'lodash-es/uniqBy';

const rootSelector = (state: RootState): ConversationsState =>
  state.conversations;

export const selectConversations = createSelector(
  [rootSelector],
  (state) => state.conversations,
);

export const selectFilteredConversations = createSelector(
  [
    selectConversations,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm?: string) => searchTerm,
    (_state, _filters, _searchTerm?: string, ignoreSectionFilter?: boolean) =>
      ignoreSectionFilter,
  ],
  (conversations, filters, searchTerm?, ignoreSectionFilter?) => {
    return conversations.filter(
      (conversation) =>
        (!searchTerm ||
          doesPromptOrConversationContainSearchTerm(
            conversation,
            searchTerm,
          )) &&
        (filters.searchFilter?.(conversation) ?? true) &&
        (ignoreSectionFilter ||
          (filters.sectionFilter?.(conversation) ?? true)),
    );
  },
);

export const selectFolders = createSelector(
  [rootSelector],
  (state: ConversationsState) => {
    return state.folders;
  },
);

export const selectEmptyFolderIds = createSelector(
  [selectFolders, selectConversations],
  (folders, conversations) => {
    return folders
      .filter(
        ({ id }) =>
          !folders.some((folder) => folder.folderId === id) &&
          !conversations.some((conv) => conv.folderId === id),
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
      entities: selectFilteredConversations(state, filters, searchTerm, true),
      searchTerm,
      includeEmptyFolders,
    }),
);

export const selectLastConversation = createSelector(
  [selectConversations],
  (conversations): ConversationInfo | undefined => {
    if (!conversations.length) return undefined;
    return sortByDateAndName([...conversations])[0];
  },
);
export const selectConversation = createSelector(
  [selectConversations, (_state, id: string) => id],
  (conversations, id): ConversationInfo | undefined => {
    return conversations.find((conv) => conv.id === id);
  },
);
export const selectSelectedConversationsIds = createSelector(
  [rootSelector],
  (state) => {
    return state.selectedConversationsIds;
  },
);
export const selectConversationSignal = createSelector(
  [rootSelector],
  (state) => {
    return state.conversationSignal;
  },
);
export const selectSelectedConversations = createSelector(
  [selectConversations, selectSelectedConversationsIds],
  (conversations, selectedConversationIds) => {
    return selectedConversationIds
      .map((id) => conversations.find((conv) => conv.id === id))
      .filter(Boolean) as Conversation[];
  },
);

export const selectLoadedCharts = createSelector([rootSelector], (state) => {
  // cloneDeep because of Plot component doesn't work with redux-toolkit maintained state slices which disallow, or guard, against state mutations.
  // PlotReactState had some additional "state" properties that were never declared or updated.
  return cloneDeep(state.loadedCharts);
});

export const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);
export const selectSelectedConversationsFoldersIds = createSelector(
  [selectSelectedConversationsIds],
  (selectedConversationsIds) => {
    return selectedConversationsIds.flatMap((id) =>
      getParentFolderIdsFromEntityId(id),
    );
  },
);
export const selectChildAndCurrentFoldersIdsById = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return new Set(getChildAndCurrentFoldersIdsById(folderId, folders));
  },
);
export const selectFullTreeChildConversationsByFolderId = createSelector(
  [selectConversations, selectChildAndCurrentFoldersIdsById],
  (conversations, foldersIds) => {
    return conversations.filter((conv) => foldersIds.has(conv.folderId));
  },
);
export const selectFullTreeChildFoldersByFolderId = createSelector(
  [selectFolders, selectChildAndCurrentFoldersIdsById],
  (folders, foldersIds) => {
    return folders.filter((folder) => foldersIds.has(folder.id));
  },
);
export const selectFirstSelectedConversation = createSelector(
  [selectSelectedConversations],
  (conversations): Conversation | undefined => {
    return conversations[0];
  },
);
export const selectIsConversationsStreaming = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => !!conv.isMessageStreaming);
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

export const selectSearchedConversations = createSelector(
  [selectConversations, selectSearchTerm],
  (conversations, searchTerm) =>
    conversations.filter((conversation) =>
      doesPromptOrConversationContainSearchTerm(conversation, searchTerm),
    ),
);

export const selectIsReplayPaused = createSelector([rootSelector], (state) => {
  return state.isReplayPaused;
});
export const selectIsSendMessageAborted = createSelector(
  [selectConversationSignal],
  (state) => {
    return state.signal.aborted;
  },
);
export const selectIsReplaySelectedConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => conv.replay?.isReplay);
  },
);

export const selectIsPlaybackSelectedConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some(
      (conv) => conv.playback && conv.playback.isPlayback,
    );
  },
);

export const selectAreSelectedConversationsExternal = createSelector(
  [(state: RootState) => state, selectSelectedConversations],
  (state, conversations) => {
    return conversations.some((conv) =>
      isEntityOrParentsExternal(state, conv, FeatureType.Chat),
    );
  },
);

export const selectDoesAnyMyItemExist = createSelector(
  [selectFolders, selectConversations],
  (folders, conversations) => {
    const conversationRootId = getConversationRootId();
    return (
      conversations.some((conv) => conv.id.startsWith(conversationRootId)) ||
      folders.some((folder) => folder.id.startsWith(conversationRootId))
    );
  },
);

export const selectPlaybackActiveIndex = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return (
      conversations[0].playback && conversations[0].playback.activePlaybackIndex
    );
  },
);

export const selectIsErrorReplayConversations = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) => conv.replay?.isError);
  },
);

export const selectIsPlaybackPaused = createSelector(
  [rootSelector],
  (state) => {
    return state.isPlaybackPaused;
  },
);

export const selectPlaybackActiveMessage = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    const activeIndex =
      conversations[0].playback &&
      conversations[0].playback.activePlaybackIndex;
    const activeMessage =
      conversations[0].playback?.messagesStack[activeIndex ?? -1];
    if (!activeMessage || activeMessage.role === Role.Assistant) {
      return;
    }
    return activeMessage;
  },
);

export const selectIsMessagesError = createSelector(
  [selectSelectedConversations],
  (conversations) => {
    return conversations.some((conv) =>
      conv.messages.some(
        (message) => typeof message.errorMessage !== 'undefined',
      ),
    );
  },
);

export const selectIsLastAssistantMessageEmpty = createSelector(
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

export const selectSelectedConversationsModels = createSelector(
  [selectSelectedConversations, ModelsSelectors.selectModelsMap],
  (conversations, modelsMap) => {
    return conversations
      .map((conv) => modelsMap[conv.model.id])
      .filter(Boolean);
  },
);

export const selectAvailableAttachmentsTypes = createSelector(
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
    ).filter((value) => (modelsAttachmentsTypes[1] || []).includes(value));

    return availableModelsAttachmentTypes.length === 0
      ? undefined
      : availableModelsAttachmentTypes;
  },
);

export const selectMaximumAttachmentsAmount = createSelector(
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

export const selectCanAttachLink = createSelector(
  [
    (state) => SettingsSelectors.isFeatureEnabled(state, Feature.InputLinks),
    selectSelectedConversationsModels,
  ],
  (inputLinksEnabled, models) => {
    if (!inputLinksEnabled || models.length === 0) {
      return false;
    }

    return models.every((model) => model?.features?.urlAttachments);
  },
);

export const selectCanAttachFile = createSelector(
  [
    (state) => SettingsSelectors.isFeatureEnabled(state, Feature.InputFiles),
    selectSelectedConversationsModels,
  ],
  (inputFilesEnabled, models) => {
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

export const hasExternalParent = createSelector(
  [selectFolders, (_state: RootState, folderId: string) => folderId],
  (folders, folderId) => {
    if (!folderId.startsWith(getConversationRootId())) {
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

export const isPublishConversationVersionUnique = createSelector(
  [
    (state) => state,
    (_state: RootState, entityId: string) => entityId,
    (_state: RootState, _entityId: string, version: string) => version,
  ],
  (state, entityId, version) => {
    const conversation = selectConversation(state, entityId) as Conversation; // TODO: will be fixed in https://github.com/epam/ai-dial-chat/issues/313

    if (!conversation || conversation?.publishVersion === version) return false;

    const conversations = selectConversations(state)
      .map((conv) => conv as Conversation) // TODO: will be fixed in https://github.com/epam/ai-dial-chat/issues/313
      .filter(
        (conv) =>
          conv.originalId === entityId && conv.publishVersion === version,
      );

    if (conversations.length) return false;

    const folders = selectFolders(state);

    const parentFolders = getParentAndCurrentFoldersById(
      folders,
      conversation.folderId,
    );
    return parentFolders.every((folder) => folder.publishVersion !== version);
  },
);
export const selectTemporaryFolders = createSelector(
  [rootSelector],
  (state: ConversationsState) => {
    return state.temporaryFolders;
  },
);

export const selectPublishedWithMeFolders = createSelector(
  [selectFolders],
  (folders) => {
    return folders.filter(
      (folder) => PublishedWithMeFilter.sectionFilter?.(folder) ?? folder,
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

    return getParentAndChildFolders(
      [...allFolders, ...temporaryFolders],
      filtered,
    );
  },
);

export const selectNewAddedFolderId = createSelector(
  [rootSelector],
  (state) => {
    return state.newAddedFolderId;
  },
);

export const getUniqueAttachments = (attachments: DialFile[]): DialFile[] =>
  uniqBy(attachments, (file) => constructPath(file.relativePath, file.name));

export const getAttachments = createSelector(
  [(state) => state, (_state: RootState, entityId: string) => entityId],
  (state, entityId) => {
    const folders = selectFolders(state);
    const conversation = selectConversation(state, entityId);
    if (conversation) {
      return getUniqueAttachments(
        getConversationAttachmentWithPath(
          conversation as Conversation, //TODO: fix in https://github.com/epam/ai-dial-chat/issues/640
          folders,
        ),
      );
    } else {
      const folderIds = new Set(
        getChildAndCurrentFoldersIdsById(entityId, folders),
      );

      if (!folderIds.size) return [];

      const conversations = selectConversations(state).filter(
        (conv) => conv.folderId && folderIds.has(conv.folderId),
      );

      return getUniqueAttachments(
        conversations.flatMap((conv) =>
          getConversationAttachmentWithPath(
            conv as Conversation, //TODO: fix in https://github.com/epam/ai-dial-chat/issues/640
            folders,
          ),
        ),
      );
    }
  },
);

export const areConversationsUploaded = createSelector(
  [rootSelector],
  (state) => {
    return state.conversationsLoaded;
  },
);

export const selectConversationsToMigrateAndMigratedCount = createSelector(
  [rootSelector],
  (state) => ({
    conversationsToMigrateCount: state.conversationsToMigrateCount,
    migratedConversationsCount: state.migratedConversationsCount,
  }),
);

export const selectFoldersStatus = createSelector([rootSelector], (state) => {
  return state.foldersStatus;
});

export const selectConversationsStatus = createSelector(
  [rootSelector],
  (state) => {
    return state.conversationsStatus;
  },
);

export const selectAreSelectedConversationsLoaded = createSelector(
  [rootSelector],
  (state) => {
    return state.areSelectedConversationsLoaded;
  },
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

export const selectLoadingFolderIds = createSelector(
  [rootSelector],
  (state) => {
    return state.loadingFolderIds;
  },
);

export const selectFailedMigratedConversations = createSelector(
  [rootSelector],
  (state) => state.failedMigratedConversations,
);

export const selectIsCompareLoading = createSelector(
  [rootSelector],
  (state) => {
    return state.compareLoading;
  },
);

export const selectIsActiveNewConversationRequest = createSelector(
  [rootSelector],
  (state) => {
    return state.isActiveNewConversationRequest;
  },
);

export const selectIsChatsBackedUp = createSelector(
  [rootSelector],
  (state) => state.isChatsBackedUp,
);
