import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { defaultReplay } from '@/utils/app/defaultStateConstants';

import { Conversation } from '@/types/chat';
import { SupportedExportFormats } from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityModel, defaultModelLimits } from '@/types/openai';

import { RootState } from '../index';

import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationsState {
  conversations: Conversation[];
  selectedConversationsIds: string[];
  folders: FolderInterface[];
  searchTerm: string;
}

const initialState: ConversationsState = {
  conversations: [],
  selectedConversationsIds: [],
  folders: [],
  searchTerm: '',
};

export const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    // Do local storage things
    initConversations: (state) => state,
    selectConversations: (
      state,
      { payload }: PayloadAction<{ conversationIds: string[] }>,
    ) => {
      const newSelectedIds = Array.from(new Set(payload.conversationIds));

      state.selectedConversationsIds = newSelectedIds;
    },
    unselectConversations: (
      state,
      { payload }: PayloadAction<{ conversationIds: string[] }>,
    ) => {
      state.selectedConversationsIds = state.selectedConversationsIds.filter(
        (id) => !payload.conversationIds.includes(id),
      );
    },
    createNewConversations: (
      state,
      _action: PayloadAction<{ names: string[] }>,
    ) => state,
    createNewConversationsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        names: string[];
        temperature: number | undefined;
        model: OpenAIEntityModel;
      }>,
    ) => {
      const newConversations: Conversation[] = payload.names.map((name) => {
        return {
          id: uuidv4(),
          name,
          messages: [],
          model: {
            id: payload.model.id,
            name: payload.model.name,
            maxLength: payload.model.maxLength ?? defaultModelLimits.maxLength,
            requestLimit:
              payload.model.requestLimit ?? defaultModelLimits.requestLimit,
            type: payload.model.type,
          },
          prompt: DEFAULT_SYSTEM_PROMPT,
          temperature: payload.temperature ?? DEFAULT_TEMPERATURE,
          folderId: null,
          replay: defaultReplay,
          selectedAddons: payload.model.selectedAddons ?? [],
          lastActivityDate: Date.now(),
          isLoading: false,
          isMessageStreaming: false,
        };
      });
      state.conversations = state.conversations.concat(newConversations);
      state.selectedConversationsIds = newConversations.map(({ id }) => id);
    },
    updateConversation: (
      state,
      { payload }: PayloadAction<{ id: string; values: Partial<Conversation> }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            ...payload.values,
          };
        }

        return conv;
      });
    },
    exportConversation: (
      state,
      _action: PayloadAction<{ conversationId: string }>,
    ) => state,
    deleteConversation: (
      state,
      { payload }: PayloadAction<{ conversationId: string }>,
    ) => {
      state.conversations = state.conversations.filter(
        (conv) => conv.id !== payload.conversationId,
      );
      state.selectedConversationsIds = state.selectedConversationsIds.filter(
        (id) => id !== payload.conversationId,
      );
    },
    createNewReplayConversation: (
      state,
      { payload }: PayloadAction<{ conversation: Conversation }>,
    ) => {
      const newConversationName = `[Replay] ${payload.conversation.name}`;

      const userMessages = payload.conversation.messages.filter(
        ({ role }) => role === 'user',
      );
      const newConversation: Conversation = {
        ...payload.conversation,
        id: uuidv4(),
        name: newConversationName,
        messages: [],

        replay: {
          isReplay: true,
          replayUserMessagesStack: userMessages,
          activeReplayIndex: 0,
        },
      };
      state.conversations = state.conversations.concat([newConversation]);
      state.selectedConversationsIds = [newConversation.id];
    },
    exportConversations: (state) => state,
    importConversations: (
      state,
      _action: PayloadAction<{ data: SupportedExportFormats }>,
    ) => state,
    importConversationsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: Conversation[];
        folders: FolderInterface[];
      }>,
    ) => {
      state.conversations = payload.conversations;
      state.folders = payload.folders;
      state.selectedConversationsIds = [
        payload.conversations[payload.conversations.length - 1].id,
      ];
    },
    updateConversations: (
      state,
      { payload }: PayloadAction<{ conversations: Conversation[] }>,
    ) => {
      state.conversations = payload.conversations;
    },
    clearConversations: (state) => {
      state.conversations = [];
      state.folders = [];
    },
    createFolder: (
      state,
      { payload }: PayloadAction<{ name: string; folderId?: string }>,
    ) => {
      const newFolder: FolderInterface = {
        id: payload.folderId || uuidv4(),
        name: payload.name,
        type: 'chat',
      };

      state.folders = state.folders.concat(newFolder);
    },
    deleteFolder: (state, { payload }: PayloadAction<{ folderId: string }>) => {
      state.folders = state.folders.filter(({ id }) => id !== payload.folderId);
    },
    renameFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            name: payload.name,
          };
        }

        return folder;
      });
    },
    setFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = payload.folders;
    },
    setSearchTerm: (
      state,
      { payload }: PayloadAction<{ searchTerm: string }>,
    ) => {
      state.searchTerm = payload.searchTerm;
    },
  },
});

const rootSelector = (state: RootState) => state.conversations;

const selectConversations = createSelector([rootSelector], (state) => {
  return state.conversations;
});
const selectLastConversation = createSelector(
  [selectConversations],
  (state): Conversation | undefined => {
    return state[0];
  },
);
const selectSelectedConversationsIds = createSelector(
  [rootSelector],
  (state) => {
    return state.selectedConversationsIds;
  },
);
const selectSelectedConversations = createSelector(
  [selectConversations, selectSelectedConversationsIds],
  (conversations, selectedConversationIds) => {
    return selectedConversationIds
      .map((id) => conversations.find((conv) => conv.id === id))
      .filter(Boolean) as Conversation[];
  },
);
const selectIsConversationsLoading = createSelector([rootSelector], (state) => {
  return state.conversations.some((conv) => !!conv.isLoading);
});
const selectIsConversationsStreaming = createSelector(
  [rootSelector],
  (state) => {
    return state.conversations.some((conv) => !!conv.isMessageStreaming);
  },
);
const selectFolders = createSelector([rootSelector], (state) => {
  return [...state.folders].sort((a, b) => a.name.localeCompare(b.name));
});
const selectSearchTerm = createSelector([rootSelector], (state) => {
  return state.searchTerm;
});
const selectSearchedConversations = createSelector(
  [selectConversations, selectSearchTerm],
  (conversations, searchTerm) => {
    return conversations.filter((conversation) => {
      const searchable =
        conversation.name.toLocaleLowerCase() +
        ' ' +
        conversation.messages.map((message) => message.content).join(' ');
      return searchable.toLowerCase().includes(searchTerm.toLowerCase());
    });
  },
);

export const ConversationsSelectors = {
  selectConversations,
  selectSelectedConversationsIds,
  selectIsConversationsLoading,
  selectLastConversation,
  selectIsConversationsStreaming,
  selectSelectedConversations,
  selectFolders,
  selectSearchTerm,
  selectSearchedConversations,
};

export const ConversationsActions = conversationsSlice.actions;
