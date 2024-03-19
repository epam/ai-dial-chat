import { PlotParams } from 'react-plotly.js';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getConversationRootId } from '@/src/utils/app/id';
import { isEntityExternal } from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import {
  Conversation,
  ConversationInfo,
  LikeState,
  Message,
} from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';
import { PublishRequest } from '@/src/types/share';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import * as ConversationsSelectors from './conversations.selectors';
import { ConversationsState } from './conversations.types';

import uniq from 'lodash-es/uniq';

export { ConversationsSelectors };

const initialState: ConversationsState = {
  conversationsToMigrateCount: 0,
  migratedConversationsCount: 0,
  isChatsBackedUp: false,
  failedMigratedConversations: [],
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
  loadedCharts: [],
  chartLoading: false,
  isActiveNewConversationRequest: false,
  isMessageSending: false,
};

export const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    init: (state) => state,
    migrateConversationsIfRequired: (state) => state,
    initConversationsMigration: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversationsToMigrateCount: number;
      }>,
    ) => {
      state.conversationsToMigrateCount = payload.conversationsToMigrateCount;
    },
    migrateConversationFinish: (
      state,
      {
        payload,
      }: PayloadAction<{
        migratedConversationsCount: number;
      }>,
    ) => {
      state.migratedConversationsCount = payload.migratedConversationsCount;
    },
    setFailedMigratedConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        failedMigratedConversations: Conversation[];
      }>,
    ) => {
      state.failedMigratedConversations = payload.failedMigratedConversations;
    },
    setIsChatsBackedUp: (
      state,
      {
        payload,
      }: PayloadAction<{
        isChatsBackedUp: boolean;
      }>,
    ) => {
      state.isChatsBackedUp = payload.isChatsBackedUp;
    },
    skipFailedMigratedConversations: (
      state,
      { payload: _ }: PayloadAction<{ idsToMarkAsMigrated: string[] }>,
    ) => state,
    initSelectedConversations: (state) => state,
    initFoldersAndConversations: (state) => state,
    initFoldersAndConversationsSuccess: (state) => state,
    saveConversation: (state, _action: PayloadAction<Conversation>) => state,
    recreateConversation: (
      state,
      _action: PayloadAction<{ new: Conversation; old: Conversation }>,
    ) => state,
    saveConversationSuccess: (state) => {
      if (state.isMessageSending) {
        state.isMessageSending = false;
      }
    },
    saveConversationFail: (state, { payload }: PayloadAction<Conversation>) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            isMessageStreaming: false,
          };
        }

        return conv;
      });
    },
    recreateConversationFail: (
      state,
      {
        payload,
      }: PayloadAction<{
        newId: string;
        oldConversation: Conversation;
      }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.newId) {
          const conversation = conv as Conversation;
          return {
            ...conversation,
            ...payload.oldConversation,
            messages: conversation.messages,
            isMessageStreaming: false,
          };
        }

        return conv;
      });
      if (payload.newId !== payload.oldConversation.id) {
        state.selectedConversationsIds = state.selectedConversationsIds.map(
          (cid) => (cid === payload.newId ? payload.oldConversation.id! : cid),
        );
      }
    },
    updateConversation: (
      state,
      _action: PayloadAction<{ id: string; values: Partial<Conversation> }>,
    ) => state,
    updateConversationSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{ id: string; conversation: Partial<Conversation> }>,
    ) => {
      state.conversations = state.conversations.map((conv) => {
        if (conv.id === payload.id) {
          return {
            ...conv,
            lastActivityDate: Date.now(),
            ...payload.conversation,
          };
        }

        return conv;
      });
      if (
        payload.id &&
        payload.conversation.id &&
        payload.id !== payload.conversation.id
      ) {
        state.selectedConversationsIds = state.selectedConversationsIds.map(
          (cid) => (cid === payload.id ? payload.conversation.id! : cid),
        );
      }
    },
    selectForCompare: (state, _action: PayloadAction<ConversationInfo>) => {
      state.compareLoading = true;
    },
    selectForCompareCompleted: (
      state,
      { payload }: PayloadAction<Conversation>,
    ) => {
      state.compareLoading = false;
      state.conversations = combineEntities([payload], state.conversations);
    },
    selectConversations: (
      state,
      { payload }: PayloadAction<{ conversationIds: string[] }>,
    ) => {
      const newSelectedIds = uniq(payload.conversationIds);

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
      _action: PayloadAction<{
        names: string[];
        shouldUploadConversationsForCompare?: boolean;
      }>,
    ) => {
      state.isActiveNewConversationRequest = true;
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
      { payload }: PayloadAction<{ id: string }>,
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
    unpublishFolder: (state, { payload }: PayloadAction<{ id: string }>) => {
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
    deleteConversationsComplete: (
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
    setIsActiveConversationRequest: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.isActiveNewConversationRequest = payload;
    },
    createNewReplayConversation: (
      state,
      _action: PayloadAction<ConversationInfo>,
    ) => state,
    saveNewConversation: (
      state,
      _action: PayloadAction<{
        newConversation: Conversation;
        idToReplaceWithNewOne?: string;
      }>,
    ) => state,
    saveNewConversationSuccess: (
      state,
      {
        payload: { newConversation, idToReplaceWithNewOne },
      }: PayloadAction<{
        newConversation: Conversation;
        idToReplaceWithNewOne?: string;
      }>,
    ) => {
      state.conversations = state.conversations.concat(newConversation);
      state.selectedConversationsIds = idToReplaceWithNewOne
        ? state.selectedConversationsIds.map((id) =>
            id === idToReplaceWithNewOne ? newConversation.id : id,
          )
        : [newConversation.id];

      state.areSelectedConversationsLoaded = true;
    },
    createNewPlaybackConversation: (
      state,
      _action: PayloadAction<ConversationInfo>,
    ) => state,
    duplicateConversation: (state, _action: PayloadAction<ConversationInfo>) =>
      state,
    importConversationsSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
        folders: FolderInterface[];
      }>,
    ) => {
      state.conversations = combineEntities(
        payload.conversations,
        state.conversations,
      );
      state.folders = combineEntities(payload.folders, state.folders);
      state.selectedConversationsIds = [
        payload.conversations[payload.conversations.length - 1].id,
      ];
    },
    // TODO: refactor this method - use only for direct write without any combination
    setConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
        ignoreCombining?: boolean;
      }>,
    ) => {
      state.conversations = payload.ignoreCombining
        ? payload.conversations
        : combineEntities(state.conversations, payload.conversations);
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
    clearConversations: (state) => {
      state.conversationsLoaded = false;
    },
    clearConversationsSuccess: (state) => {
      state.conversations = state.conversations.filter(
        (conv) =>
          isEntityExternal(conv) ||
          ConversationsSelectors.hasExternalParent(
            { conversations: state },
            conv.folderId,
          ),
      );
      state.folders = state.folders.filter(
        (folder) =>
          isEntityExternal(folder) ||
          ConversationsSelectors.hasExternalParent(
            { conversations: state },
            folder.folderId,
          ),
      );
    },
    createFolder: (
      state,
      { payload }: PayloadAction<{ name?: string; parentId: string }>,
    ) => {
      const newFolder: FolderInterface = addGeneratedFolderId({
        folderId: payload?.parentId,
        name:
          // custom name
          payload?.name ??
          // default name with counter
          ConversationsSelectors.selectNewFolderName(
            { conversations: state },
            payload?.parentId,
          ),
        type: FolderType.Chat,
        status: UploadStatus.LOADED,
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
      const id = constructPath(
        payload.relativePath || getConversationRootId(),
        folderName,
      );

      state.temporaryFolders.push({
        id,
        name: folderName,
        type: FolderType.Chat,
        folderId: payload.relativePath || getConversationRootId(),
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

    renameTemporaryFolder: (
      state,
      { payload }: PayloadAction<{ folderId: string; name: string }>,
    ) => {
      state.newAddedFolderId = undefined;
      const name = payload.name.trim();

      state.temporaryFolders = state.temporaryFolders.map((folder) =>
        folder.id !== payload.folderId ? folder : { ...folder, name },
      );
    },
    resetNewFolderId: (state) => {
      state.newAddedFolderId = undefined;
    },
    updateFolder: (
      state,
      {
        payload,
      }: PayloadAction<{ folderId: string; values: Partial<FolderInterface> }>,
    ) => {
      state.folders = state.folders.map((folder) => {
        if (folder.id === payload.folderId) {
          return {
            ...folder,
            ...payload.values,
          };
        }

        return folder;
      });
    },
    updateFolderSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        folders: FolderInterface[];
        conversations: ConversationInfo[];
        selectedConversationsIds: string[];
      }>,
    ) => {
      state.folders = payload.folders;
      state.conversations = payload.conversations;
      state.selectedConversationsIds = payload.selectedConversationsIds;
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
        rate: LikeState;
      }>,
    ) => state,
    rateMessageSuccess: (
      state,
      _action: PayloadAction<{
        conversationId: string;
        messageIndex: number;
        rate: LikeState;
      }>,
    ) => state,
    rateMessageFail: (
      state,
      _action: PayloadAction<{ error: Response | string }>,
    ) => state,
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
      {
        payload,
      }: PayloadAction<{
        conversationId: string;
        isRestart?: boolean;
        activeReplayIndex: number;
      }>,
    ) => {
      state.isReplayPaused = false;
      state.conversations = (state.conversations as Conversation[]).map(
        (conv) =>
          conv.id === payload.conversationId
            ? {
                ...conv,
                replay: {
                  ...conv.replay,
                  activeReplayIndex: payload.activeReplayIndex,
                },
              }
            : conv,
      );
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

    uploadConversationsWithFolders: (
      state,
      { payload }: PayloadAction<{ paths: (string | undefined)[] }>,
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
        allLoaded?: boolean;
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.filter(
        (id) => !payload.paths.has(id),
      );
      state.foldersStatus = UploadStatus.LOADED;
      state.folders = combineEntities(state.folders, payload.folders).map(
        (f) =>
          payload.paths.has(f.id)
            ? {
                ...f,
                status: UploadStatus.LOADED,
              }
            : f,
      );
      if (payload.allLoaded) {
        state.conversationsLoaded = true;
      }
      state.foldersStatus = payload.allLoaded
        ? UploadStatus.ALL_LOADED
        : UploadStatus.LOADED;
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
    uploadConversationsWithFoldersRecursive: (
      state,
      {
        payload,
      }: PayloadAction<
        { path?: string; selectFirst?: boolean; noLoader?: boolean } | undefined
      >,
    ) => {
      state.conversationsStatus = UploadStatus.LOADING;
      state.conversationsLoaded = !payload?.noLoader;
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
      const conversationMap = state.conversations.reduce((map, conv) => {
        map.set(conv.id, conv);
        return map;
      }, new Map<string, ConversationInfo>());

      const ids = new Set(payload.conversations.map((c) => c.id));

      state.conversations = combineEntities(
        state.conversations,
        payload.conversations.map((conv) =>
          ids.has(conv.id)
            ? {
                ...conversationMap.get(conv.id),
                ...conv,
              }
            : conv,
        ),
      );
      state.conversationsStatus = UploadStatus.LOADED;
    },
    uploadConversationsFail: (state) => {
      state.conversationsStatus = UploadStatus.FAILED;
    },
    toggleFolder: (
      state,
      _action: PayloadAction<{
        id: string;
      }>,
    ) => state,
    setIsMessageSending: (state, { payload }: PayloadAction<boolean>) => {
      state.isMessageSending = payload;
    },
    getChartAttachment: (
      state,
      _action: PayloadAction<{
        pathToChart: string;
      }>,
    ) => {
      state.chartLoading = true;
    },
    getChartAttachmentSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        params: PlotParams;
        pathToChart: string;
      }>,
    ) => {
      state.loadedCharts = state.loadedCharts.find(
        (chart) => chart.url === payload.pathToChart,
      )
        ? state.loadedCharts
        : [
            ...state.loadedCharts,
            {
              url: payload.pathToChart,
              data: payload.params,
            },
          ];
      state.chartLoading = false;
    },
  },
});

export const ConversationsActions = conversationsSlice.actions;
