import { createSelector } from '@reduxjs/toolkit';

import {
  getChildAndCurrentFoldersIdsById,
  getParentAndCurrentFoldersById,
} from '@/src/utils/app/folders';
import { doesConversationContainSearchTerm } from '@/src/utils/app/search';

import { Conversation, Role } from '@/src/types/chat';
import { EntityFilter, EntityType } from '@/src/types/common';
import { FolderInterface, FolderItemFilters } from '@/src/types/folder';

import { RootState } from '../index';
import { ModelsSelectors } from '../models/models.reducers';
import { ConversationsState } from './conversations.types';

const rootSelector = (state: RootState): ConversationsState =>
  state.conversations;

export const selectConversations = createSelector([rootSelector], (state) => {
  return state.conversations;
});

// export const selectFilteredConversations2 = ({
//   filter,
//   onlyRoot,
//   searchTerm,
// }: {
//   filter?: EntityFilter<Conversation>;
//   onlyRoot?: boolean;
//   searchTerm?: string;
// }) =>
//   createSelector([selectConversations], (conversations) => {
//     return conversations.filter(
//       (conversation) =>
//         (!onlyRoot || !conversation.folderId) &&
//         (!searchTerm ||
//           doesConversationContainSearchTerm(conversation, searchTerm)) &&
//         (!filter || filter(conversation)),
//     );
//   });

// export const selectFilteredConversations3 = (
//   state: RootState,
//   {
//     filter,
//     onlyRoot,
//     searchTerm,
//   }: {
//     filter?: EntityFilter<Conversation>;
//     onlyRoot?: boolean;
//     searchTerm?: string;
//   },
// ) =>
//   createSelector([selectConversations], (conversations) => {
//     return conversations.filter(
//       (conversation) =>
//         (!onlyRoot || !conversation.folderId) &&
//         (!searchTerm ||
//           doesConversationContainSearchTerm(conversation, searchTerm)) &&
//         (!filter || filter(conversation)),
//     );
//   })(state);

export const selectFilteredConversations = createSelector(
  [
    selectConversations,
    (_, filter?: EntityFilter<Conversation>) => filter,
    (_, __, onlyRoot?: boolean) => onlyRoot,
    (_, __, ___, searchTerm?: string) => searchTerm,
  ],
  (conversations, filter, onlyRoot, searchTerm) => {
    return conversations.filter(
      (conversation) =>
        (!onlyRoot || !conversation.folderId) &&
        (!searchTerm ||
          doesConversationContainSearchTerm(conversation, searchTerm)) &&
        (!filter || filter(conversation)),
    );
  },
);

export const selectFolders = createSelector([rootSelector], (state) => {
  return state.folders;
});

export const selectRootFolders = createSelector(
  [selectFolders, (_, filter?: EntityFilter<FolderInterface>) => filter],
  (folders, filter) => {
    return folders.filter(
      (folder) => !folder.folderId && (!filter || filter(folder)),
    );
  },
);

export const selectAreFolderItemsExists = createSelector(
  [
    selectFolders,
    selectConversations,
    (_, filters: FolderItemFilters<Conversation>) => filters,
  ],
  (folders, conversations, filters) => {
    return (
      folders.filter((folder) => filters.filterFolder(folder)).length ||
      conversations.filter((conversation) => filters.filterItem(conversation))
        .length
    );
  },
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
    return getChildAndCurrentFoldersIdsById(folderId, folders);
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
        lastMessage.role === Role.Assistant && lastMessage.content.length === 0
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
