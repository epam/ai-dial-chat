import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { generateNextName, getNextDefaultName } from '@/src/utils/app/folders';
import { isEntityExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { SearchFilters } from './../../types/search';
import {
  Conversation,
  ConversationEntityModel,
  Message,
  Role,
} from '@/src/types/chat';
import { SupportedExportFormats } from '@/src/types/export';
import { FolderInterface, FolderType } from '@/src/types/folder';

import { resetShareEntity } from './../../constants/chat';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-settings';
import { defaultReplay } from '@/src/constants/replay';

import { hasExternalParent } from './conversations.selectors';
import { ConversationsState } from './conversations.types';

import { v4 as uuidv4 } from 'uuid';

export * as ConversationsSelectors from './conversations.selectors';

const initialState: ConversationsState = {
  conversations: [],
  selectedConversationsIds: [],
  folders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
  conversationSignal: new AbortController(),
  isReplayPaused: true,
  isPlaybackPaused: true,
};

export const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    init: (state) => state,
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
        model: ConversationEntityModel;
      }>,
    ) => {
      const newConversations: Conversation[] = payload.names.map(
        (name, index): Conversation => {
          return {
            id: uuidv4(),
            name:
              name !== DEFAULT_CONVERSATION_NAME
                ? name
                : getNextDefaultName(
                    DEFAULT_CONVERSATION_NAME,
                    state.conversations,
                    index,
                  ),
            messages: [],
            model: {
              id: payload.model.id,
            },
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: payload.temperature ?? DEFAULT_TEMPERATURE,
            replay: defaultReplay,
            selectedAddons: [],
            lastActivityDate: Date.now(),
            isMessageStreaming: false,
          };
        },
      );
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
    shareConversation: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isShared: true,
          };
        }

        return conv;
      });
    },
    shareFolder: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isShared: true,
          };
        }

        return folder;
      });
    },
    publishConversation: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isPublished: true,
          };
        }

        return conv;
      });
    },
    publishFolder: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: send newShareId to API to store {id, createdDate, type: conversation/prompt/folder}
            isPublished: true,
          };
        }

        return folder;
      });
    },
    unpublishConversation: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            //TODO: unpublish conversation by API
            isPublished: false,
          };
        }

        return conv;
      });
    },
    unpublishFolder: (
      state,
      { payload }: PayloadAction<{ id: string; shareUniqueId: string }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.id) {
          return {
            ...folder,
            //TODO: unpublish folder by API
            isPublished: false,
          };
        }

        return folder;
      });
    },
    exportConversation: (
      state,
      _action: PayloadAction<{ conversationId: string }>,
    ) => state,
    deleteConversations: (
      state,
      { payload }: PayloadAction<{ conversationIds: string[] }>,
    ) => {
      state.conversations = state.conversations.filter(
        (conv) => !payload.conversationIds.includes(conv.id),
      );
      state.selectedConversationsIds = state.selectedConversationsIds.filter(
        (id) => !payload.conversationIds.includes(id),
      );
    },
    createNewReplayConversation: (
      state,
      { payload }: PayloadAction<{ conversation: Conversation }>,
    ) => {
      const newConversationName = `[Replay] ${payload.conversation.name}`;

      const userMessages = payload.conversation.messages.filter(
        ({ role }) => role === Role.User,
      );
      const newConversation: Conversation = {
        ...payload.conversation,
        ...resetShareEntity,
        id: uuidv4(),
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        replay: {
          isReplay: true,
          replayUserMessagesStack: userMessages,
          activeReplayIndex: 0,
          replayAsIs: true,
        },

        playback: {
          isPlayback: false,
          activePlaybackIndex: 0,
          messagesStack: [],
        },
      };
      state.conversations = state.conversations.concat(newConversation);
      state.selectedConversationsIds = [newConversation.id];
    },
    createNewPlaybackConversation: (
      state,
      { payload }: PayloadAction<{ conversation: Conversation }>,
    ) => {
      const newConversationName = `[Playback] ${payload.conversation.name}`;

      const newConversation: Conversation = {
        ...payload.conversation,
        ...resetShareEntity,
        id: uuidv4(),
        name: newConversationName,
        messages: [],
        lastActivityDate: Date.now(),

        playback: {
          messagesStack: payload.conversation.messages,
          activePlaybackIndex: 0,
          isPlayback: true,
        },

        replay: {
          isReplay: false,
          replayUserMessagesStack: [],
          activeReplayIndex: 0,
          replayAsIs: false,
        },
      };
      state.conversations = state.conversations.concat(newConversation);
      state.selectedConversationsIds = [newConversation.id];
    },
    duplicateConversation: (
      state,
      { payload }: PayloadAction<{ conversation: Conversation }>,
    ) => {
      const newConversation: Conversation = {
        ...payload.conversation,
        ...resetShareEntity,
        name: generateNextName(
          DEFAULT_CONVERSATION_NAME,
          payload.conversation.name,
          state.conversations,
          0,
        ),
        id: uuidv4(),
        lastActivityDate: Date.now(),
      };
      state.conversations = state.conversations.concat(newConversation);
      state.selectedConversationsIds = [newConversation.id];
    },
    duplicateSelectedConversations: (state) => {
      const selectedIds = new Set(state.selectedConversationsIds);
      const newSelectedIds: string[] = [];
      const newConversations: Conversation[] = [];
      selectedIds.forEach((id) => {
        const conversation = state.conversations.find((conv) => conv.id === id);
        if (
          conversation &&
          (isEntityExternal(conversation) ||
            hasExternalParent({ conversations: state }, conversation.folderId))
        ) {
          const newConversation: Conversation = {
            ...conversation,
            ...resetShareEntity,
            folderId: undefined,
            name: generateNextName(
              DEFAULT_CONVERSATION_NAME,
              conversation.name,
              state.conversations.concat(newConversations),
              0,
            ),
            id: uuidv4(),
            lastActivityDate: Date.now(),
          };
          newConversations.push(newConversation);
          newSelectedIds.push(newConversation.id);
        } else {
          newSelectedIds.push(id);
        }
      });
      state.conversations = state.conversations.concat(newConversations);
      state.selectedConversationsIds = newSelectedIds;
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
    addConversations: (
      state,
      { payload }: PayloadAction<{ conversations: Conversation[] }>,
    ) => {
      state.conversations = state.conversations.concat(payload.conversations);
    },
    clearConversations: (state) => {
      state.conversations = [];
      state.folders = [];
    },
    createFolder: (
      state,
      {
        payload,
      }: PayloadAction<{ name?: string; folderId?: string } | undefined>,
    ) => {
      const newFolder: FolderInterface = {
        id: payload?.folderId || uuidv4(),
        name:
          payload?.name ?? // custom name
          getNextDefaultName(translate('New folder'), state.folders), // default name with counter
        type: FolderType.Chat,
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
      const name = payload.name.trim();
      if (name === '') {
        return;
      }
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            name,
          };
        }

        return folder;
      });
    },
    moveFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        newParentFolderId: string | undefined;
        newIndex: number;
      }>,
    ) => {
      const folderIndex = state.folders.findIndex(
        (folder) => folder.id === payload.folderId,
      );
      const updatedFolderContent = {
        ...state.folders[folderIndex],
        folderId: payload.newParentFolderId,
      };
      state.folders = state.folders
        .toSpliced(folderIndex, 1)
        .toSpliced(
          folderIndex < payload.newIndex
            ? payload.newIndex - 1
            : payload.newIndex,
          0,
          updatedFolderContent,
        );
    },
    setFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = payload.folders;
    },
    addFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = state.folders.concat(payload.folders);
    },
    setSearchTerm: (
      state,
      { payload }: PayloadAction<{ searchTerm: string }>,
    ) => {
      state.searchTerm = payload.searchTerm;
    },
    setSearchFilters: (
      state,
      { payload }: PayloadAction<{ searchFilters: SearchFilters }>,
    ) => {
      state.searchFilters = payload.searchFilters;
    },
    resetSearch: (state) => {
      state.searchTerm = '';
      state.searchFilters = SearchFilters.None;
    },
    updateMessage: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        messageIndex: number;
        values: Partial<Message>;
      }>,
    ) => state,
    rateMessage: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        messageIndex: number;
        rate: number;
      }>,
    ) => state,
    rateMessageSuccess: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        messageIndex: number;
        rate: number;
      }>,
    ) => state,
    rateMessageFail: (
      state,
      _action: PayloadAction<{ error: Response | string }>,
    ) => state,
    cleanMessage: (state) => state,
    deleteMessage: (state, _action: PayloadAction<{ index: number }>) => state,
    sendMessages: (
      state,
      _action: PayloadAction<{
        conversations: Conversation[];
        message: Message;
        deleteCount: number;
        activeReplayIndex: number;
      }>,
    ) => state,
    sendMessage: (
      state,
      _action: PayloadAction<{
        conversation: Conversation;
        message: Message;
        deleteCount: number;
        activeReplayIndex: number;
      }>,
    ) => state,
    streamMessage: (
      state,
      _action: PayloadAction<{
        conversation: Conversation;
        message: Message;
      }>,
    ) => state,
    createAbortController: (state) => {
      state.conversationSignal = new AbortController();
    },
    streamMessageFail: (
      state,
      _action: PayloadAction<{
        conversation: Conversation;
        message: string;
        response?: Response;
      }>,
    ) => state,
    streamMessageSuccess: (state) => state,
    mergeMessage: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        chunkValue: Partial<Message>;
      }>,
    ) => state,
    stopStreamMessage: (state) => state,
    replayConversations: (
      state,
      _action: PayloadAction<{
        conversationsIds: string[];
        isRestart?: boolean;
      }>,
    ) => state,
    replayConversation: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        isRestart?: boolean;
      }>,
    ) => {
      state.isReplayPaused = false;
    },
    stopReplayConversation: (state) => {
      state.isReplayPaused = true;
    },
    endReplayConversation: (
      state,
      _action: PayloadAction<{
        conversationId: string;
      }>,
    ) => {
      state.isReplayPaused = true;
    },
    playbackNextMessageStart: (state) => {
      state.isPlaybackPaused = false;
    },
    playbackNextMessageEnd: (
      state,
      _action: PayloadAction<{ conversationId: string }>,
    ) => state,
    playbackPrevMessage: (state) => state,
    playbackStop: (state) => {
      state.isPlaybackPaused = true;
    },
    playbackCancel: (state) => {
      state.isPlaybackPaused = true;
    },

    initFolders: (state) => state,
  },
});

export const ConversationsActions = conversationsSlice.actions;
