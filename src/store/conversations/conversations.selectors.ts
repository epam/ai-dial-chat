import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getParentAndCurrentFolderIdsById,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';
import {
  doesConversationContainSearchTerm,
  getMyItemsFilters,
  searchSectionFolders,
} from '@/src/utils/app/search';
import { isEntityExternal } from '@/src/utils/app/share';

import { Conversation, Role } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { EntityFilters, SearchFilters } from '@/src/types/search';

import { RootState } from '../index';
import { ModelsSelectors } from '../models/models.reducers';
import { ConversationsState } from './conversations.types';

const rootSelector = (state: RootState): ConversationsState =>
  state.conversations;

export const selectConversations = createSelector([rootSelector], (state) => {
  return state.conversations;
});

export const selectFilteredConversations = createSelector(
  [
    selectConversations,
    (_state, filters: EntityFilters) => filters,
    (_state, _filters, searchTerm?: string) => searchTerm,
  ],
  (conversations, filters, searchTerm?) => {
    return conversations.filter(
      (conversation) =>
        (!searchTerm ||
          doesConversationContainSearchTerm(conversation, searchTerm)) &&
        filters.searchFilter(conversation) &&
        (conversation.folderId || filters.sectionFilter(conversation)),
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
    folders,
    emptyFolderIds,
    filters,
    searchTerm?,
    includeEmptyFolders?,
  ) => {
    const filteredConversations = selectFilteredConversations(
      state,
      filters,
      searchTerm,
    );
    const folderIds = filteredConversations // direct parent folders
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

export const selectLastConversation = createSelector(
  [selectConversations],
  (state): Conversation | undefined => {
    return state[0];
  },
);
export const selectConversation = createSelector(
  [selectConversations, (_state, id: string) => id],
  (conversations, id): Conversation | undefined => {
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
export const selectParentFolders = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return getParentAndCurrentFoldersById(folders, folderId);
  },
);
const selectParentFoldersIds = createSelector(
  [selectParentFolders],
  (folders) => {
    return folders.map((folder) => folder.id);
  },
);
export const selectSelectedConversationsFoldersIds = createSelector(
  [(state) => state, selectSelectedConversations],
  (state, conversations) => {
    let selectedFolders: string[] = [];

    conversations.forEach((conv) => {
      selectedFolders = selectedFolders.concat(
        selectParentFoldersIds(state, conv.folderId),
      );
    });

    return selectedFolders;
  },
);
export const selectChildAndCurrentFoldersIdsById = createSelector(
  [selectFolders, (_state, folderId: string | undefined) => folderId],
  (folders, folderId) => {
    return new Set(getChildAndCurrentFoldersIdsById(folderId, folders));
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
      doesConversationContainSearchTerm(conversation, searchTerm),
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
    return conversations.some((conv) => conv.replay.isReplay);
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
    return conversations.some(
      (conv) =>
        isEntityExternal(conv) || hasExternalParent(state, conv.folderId),
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
    return conversations.some((conv) => conv.replay.isError);
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

export const selectNotModelConversations = createSelector(
  [selectSelectedConversations, ModelsSelectors.selectModelsMap],
  (conversations, modelsMap) => {
    return conversations.some(
      (conv) =>
        modelsMap[conv.model.id]?.type !== EntityType.Model ||
        conv.selectedAddons.length > 0,
    );
  },
);
const selectSelectedConversationsModels = createSelector(
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
      ...models.map((model) =>
        model?.inputAttachmentTypes ? Number.MAX_SAFE_INTEGER : 0,
      ),
    );
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
    const conversation = selectConversation(state, entityId);

    if (!conversation || conversation?.publishVersion === version) return false;

    const conversations = selectConversations(state).filter(
      (conv) => conv.originalId === entityId && conv.publishVersion === version,
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
