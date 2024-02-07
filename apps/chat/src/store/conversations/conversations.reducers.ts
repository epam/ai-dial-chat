import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { addGeneratedConversationId } from '@/src/utils/app/conversation';
import {
  addGeneratedFolderId,
  generateNextName,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import { Conversation, ConversationInfo, Message } from '@/src/types/chat';
import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';
import { PublishRequest } from '@/src/types/share';

import { resetShareEntity } from '@/src/constants/chat';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_FOLDER_NAME,
} from '@/src/constants/default-settings';

import * as ConversationsSelectors from './conversations.selectors';
import { ConversationsState } from './conversations.types';

import { v4 as uuidv4 } from 'uuid';

export { ConversationsSelectors };

const initialState: ConversationsState = {
  conversations: [],
  selectedConversationsIds: [],
  folders: [],
  temporaryFolders: [],
  searchTerm: '',
  searchFilters: SearchFilters.None,
  conversationSignal: new AbortController(),
  isReplayPaused: true,
  isPlaybackPaused: true,
  newAddedFolderId: undefined,
  conversationsLoaded: false,
  areSelectedConversationsLoaded: false,
  conversationsStatus: UploadStatus.UNINITIALIZED,
  foldersStatus: UploadStatus.UNINITIALIZED,
  loadingFolderIds: [],
};

export const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    init: (state) => state,
    initSelectedConversations: (state) => state,
    initFoldersEndConversations: (state) => state,
    saveConversation: (state, _action: PayloadAction<Conversation>) => state,
    recreateConversation: (
      state,
      _action: PayloadAction<{ new: Conversation; old: Conversation }>,
    ) => state,
    updateConversation: (
      state,
      _action: PayloadAction<{ id: string; values: Partial<Conversation> }>,
    ) => state,
    updateConversationSuccess: (
      state,
      { payload }: PayloadAction<{ id: string; conversation: Conversation }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            ...payload.conversation,
            lastActivityDate: Date.now(),
          };
        }

        return conv;
      });
      if (payload.id !== payload.conversation.id) {
        state.selectedConversationsIds = state.selectedConversationsIds.map(
          (cid) => (cid === payload.id ? payload.conversation.id : cid),
        );
      }
    },
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
      { payload }: PayloadAction<PublishRequest>,
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
    publishFolder: (state, { payload }: PayloadAction<PublishRequest>) => {
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

    deleteConversations: (
      state,
      _action: PayloadAction<{ conversationIds: string[] }>,
    ) => state,
    deleteConversationsSuccess: (
      state,
      { payload }: PayloadAction<{ deleteIds: Set<string> }>,
    ) => {
      state.conversations = state.conversations.filter(
        (conv) => !payload.deleteIds.has(conv.id),
      );
      state.selectedConversationsIds = state.selectedConversationsIds.filter(
        (id) => !payload.deleteIds.has(id),
      );
    },
    uploadConversationsByIds: (
      state,
      {
        payload,
      }: PayloadAction<{ conversationIds: string[]; showLoader?: boolean }>,
    ) => {
      if (payload.showLoader) {
        state.areSelectedConversationsLoaded = false;
      }
    },
    uploadConversationsByIdsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        setIds: Set<string>;
        conversations: Conversation[];
        showLoader?: boolean;
      }>,
    ) => {
      state.conversations = combineEntities(
        payload.conversations.map((conv) => ({
          ...conv,
          isMessageStreaming: false, // we shouldn't try to continue stream after upload
        })),
        state.conversations.filter((conv) => !payload.setIds.has(conv.id)),
      );
      if (payload.showLoader) {
        state.areSelectedConversationsLoaded = true;
      }
    },
    createNewReplayConversation: (
      state,
      _action: PayloadAction<ConversationInfo>,
    ) => state,
    createNewConversationSuccess: (
      state,
      {
        payload: { newConversation },
      }: PayloadAction<{ newConversation: Conversation }>,
    ) => {
      state.conversations = state.conversations.concat(newConversation);
      state.selectedConversationsIds = [newConversation.id];
    },
    createNewPlaybackConversation: (
      state,
      _action: PayloadAction<ConversationInfo>,
    ) => state,
    duplicateConversation: (state, _action: PayloadAction<ConversationInfo>) =>
      state,
    duplicateSelectedConversations: (state) => {
      const selectedIds = new Set(state.selectedConversationsIds);
      const newSelectedIds: string[] = [];
      const newConversations: Conversation[] = [];
      selectedIds.forEach((id) => {
        const conversation = state.conversations.find((conv) => conv.id === id);
        if (
          conversation &&
          isEntityOrParentsExternal(
            { conversations: state },
            conversation,
            FeatureType.Chat,
          )
        ) {
          const newConversation: Conversation = addGeneratedConversationId({
            ...(conversation as Conversation),
            ...resetShareEntity,
            folderId: undefined,
            name: generateNextName(
              DEFAULT_CONVERSATION_NAME,
              conversation.name,
              state.conversations.concat(newConversations),
              0,
            ),
            lastActivityDate: Date.now(),
          });
          newConversations.push(newConversation);
          newSelectedIds.push(newConversation.id);
        } else {
          newSelectedIds.push(id);
        }
      });
      state.conversations = state.conversations.concat(newConversations); // TODO: save in API
      state.selectedConversationsIds = newSelectedIds;
    },
    importConversationsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
        folders: FolderInterface[];
      }>,
    ) => {
      state.conversations = payload.conversations;
      state.folders = payload.folders;
      state.selectedConversationsIds = [
        payload.conversations[payload.conversations.length - 1].id,
      ];
    },
    setConversations: (
      state,
      { payload }: PayloadAction<{ conversations: ConversationInfo[] }>,
    ) => {
      state.conversations = combineEntities(
        state.conversations,
        payload.conversations,
      );
      state.conversationsLoaded = true;
    },
    addConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
        selectAdded?: boolean;
      }>,
    ) => {
      state.conversations = combineEntities(
        payload.conversations,
        state.conversations,
      );
      if (payload.selectAdded) {
        state.selectedConversationsIds = payload.conversations.map(
          ({ id }) => id,
        );
        state.areSelectedConversationsLoaded = true;
      }
    },
    clearConversations: (state) => state,
    clearConversationsSuccess: (state) => {
      state.conversations = [];
      state.folders = [];
    },
    createFolder: (
      state,
      {
        payload,
      }: PayloadAction<{ name?: string; parentId?: string } | undefined>,
    ) => {
      const newFolder: FolderInterface = addGeneratedFolderId({
        folderId: payload?.parentId,
        name:
          // custom name
          payload?.name ??
          // default name with counter
          ConversationsSelectors.selectNewFolderName({ conversations: state }),
        type: FolderType.Chat,
      });

      state.folders = state.folders.concat(newFolder);
    },
    createTemporaryFolder: (
      state,
      {
        payload,
      }: PayloadAction<{
        relativePath?: string;
      }>,
    ) => {
      const folderName = getNextDefaultName(
        translate(DEFAULT_FOLDER_NAME),
        [
          ...state.temporaryFolders,
          ...state.folders.filter((folder) => folder.publishedWithMe),
        ],
        0,
        false,
        true,
      );
      const id = uuidv4();

      state.temporaryFolders.push({
        id,
        name: folderName,
        type: FolderType.Chat,
        folderId: payload.relativePath,
        temporary: true,
      });
      state.newAddedFolderId = id;
    },
    deleteFolder: (state, _action: PayloadAction<{ folderId?: string }>) =>
      state,
    deleteTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string }>,
    ) => {
      state.temporaryFolders = state.temporaryFolders.filter(
        ({ id }) => id !== payload.folderId,
      );
    },
    deleteAllTemporaryFolders: (state) => {
      state.temporaryFolders = [];
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
    renameTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      state.newAddedFolderId = undefined;
      const name = payload.name.trim();
      if (name === '') {
        return;
      }

      state.temporaryFolders = state.temporaryFolders.map((folder) =>
        folder.id !== payload.folderId ? folder : { ...folder, name },
      );
    },
    resetNewFolderId: (state) => {
      state.newAddedFolderId = undefined;
    },
    moveFolder: (
      state,
      _action: PayloadAction<{
        folderId: string;
        newParentFolderId: string | undefined;
      }>,
    ) => state,
    moveFolderSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        folderId: string;
        newParentFolderId: string | undefined;
      }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return addGeneratedFolderId({
            ...folder,
            folderId: payload.newParentFolderId,
          });
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
    addFolders: (
      state,
      { payload }: PayloadAction<{ folders: FolderInterface[] }>,
    ) => {
      state.folders = combineEntities(payload.folders, state.folders);
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

    uploadOpenFolders: (
      state,
      _action: PayloadAction<{
        paths: (string | undefined)[];
      }>,
    ) => state,
    uploadConversationsWithFolders: (
      state,
      _action: PayloadAction<{
        paths: (string | undefined)[];
        withOpenChildren?: boolean;
      }>,
    ) => state,

    uploadFolders: (
      state,
      {
        payload,
      }: PayloadAction<{
        paths: (string | undefined)[];
        withOpenChildren?: boolean;
      }>,
    ) => {
      state.foldersStatus = UploadStatus.LOADING;
      state.loadingFolderIds = state.loadingFolderIds.concat(
        payload.paths as string[],
      );
    },
    uploadFoldersSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        paths: Set<string | undefined>;
        folders: FolderInterface[];
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.filter(
        (id) => !payload.paths.has(id),
      );
      state.foldersStatus = UploadStatus.LOADED;
      state.folders = payload.folders.concat(
        state.folders.filter((folder) => !payload.paths.has(folder.folderId)),
      );
    },
    uploadFoldersFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        paths: Set<string | undefined>;
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.filter(
        (id) => !payload.paths.has(id),
      );
      state.foldersStatus = UploadStatus.FAILED;
    },

    uploadConversations: (
      state,
      _action: PayloadAction<{
        paths: (string | undefined)[];
      }>,
    ) => {
      state.conversationsStatus = UploadStatus.LOADING;
    },

    uploadConversationsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        paths: Set<string | undefined>;
        conversations: ConversationInfo[];
      }>,
    ) => {
      state.conversations = payload.conversations.concat(
        state.conversations.filter((conv) => !payload.paths.has(conv.folderId)),
      );
      state.conversationsStatus = UploadStatus.LOADED;
    },
    uploadConversationsFail: (state) => {
      state.conversationsStatus = UploadStatus.FAILED;
    },
    toggleFolder: (
      state,
      _action: PayloadAction<{
        folderId: string;
      }>,
    ) => state,
  },
});

export const ConversationsActions = conversationsSlice.actions;
