import { PlotParams } from 'react-plotly.js';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { combineEntities } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  addGeneratedFolderId,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import {
  getConversationRootId,
  isRootConversationsId,
} from '@/src/utils/app/id';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import {
  isEntityExternal,
  isEntityOrParentsExternal,
} from '@/src/utils/app/share';
import { translate } from '@/src/utils/app/translation';

import {
  Conversation,
  ConversationInfo,
  LikeState,
  Message,
} from '@/src/types/chat';
import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderInterface, FolderType } from '@/src/types/folder';
import { SearchFilters } from '@/src/types/search';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import * as ConversationsSelectors from './conversations.selectors';
import { ConversationsState } from './conversations.types';

import { CustomVisualizerData } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

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
  loadedCharts: [],
  chartLoading: false,
  isActiveNewConversationRequest: false,
  isMessageSending: false,
  loadedCustomAttachmentsData: [],
  customAttachmentDataLoading: false,
  chosenConversationIds: [],
  chosenFolderIds: [],
};

export const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    init: (state) => state,
    initSelectedConversations: (state) => state,
    initFoldersAndConversations: (state) => state,
    initFoldersAndConversationsSuccess: (state) => {
      state.conversationsLoaded = true;
    },
    getSelectedConversations: (
      state,
      _action: PayloadAction<{ createNew: boolean } | undefined>,
    ) => state,
    saveConversation: (state, _action: PayloadAction<Conversation>) => state,
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
    recreateConversation: (
      state,
      _action: PayloadAction<{ new: Conversation; old: Conversation }>,
    ) => state,
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
          (id) => (id === payload.newId ? payload.oldConversation.id! : id),
        );
      }
    },
    updateConversation: (
      state,
      _action: PayloadAction<{
        id: string;
        values: Partial<Conversation>;
      }>,
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
          (id) => (id === payload.id ? payload.conversation.id! : id),
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
      state.selectedConversationsIds = uniq(payload.conversationIds);
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
    deleteConversations: (
      state,
      _action: PayloadAction<{
        conversationIds: string[];
        suppressErrorMessage?: boolean;
      }>,
    ) => state,
    deleteConversationsComplete: (
      state,
      { payload }: PayloadAction<{ conversationIds: Set<string> }>,
    ) => {
      state.conversations = state.conversations.filter(
        (conv) => !payload.conversationIds.has(conv.id),
      );
      state.selectedConversationsIds = state.selectedConversationsIds.filter(
        (id) => !payload.conversationIds.has(id),
      );
      state.conversationsLoaded = true;
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
        state.conversations,
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
      state.selectedConversationsIds =
        idToReplaceWithNewOne && state.selectedConversationsIds.length > 1
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
    },
    setConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
      }>,
    ) => {
      state.conversations = payload.conversations;
      state.conversationsLoaded = true;
    },
    addConversations: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversations: ConversationInfo[];
        suspendHideSidebar?: boolean;
      }>,
    ) => {
      state.conversations = combineEntities(
        payload.conversations,
        state.conversations,
      );
    },
    clearConversations: (state) => {
      state.conversationsLoaded = false;
      state.areSelectedConversationsLoaded = false;
    },
    clearConversationsSuccess: (state) => {
      state.conversations = state.conversations.filter((conv) =>
        isEntityOrParentsExternal(
          { conversations: state },
          conv,
          FeatureType.Chat,
        ),
      );
      state.folders = state.folders.filter((folder) =>
        isEntityOrParentsExternal(
          { conversations: state },
          folder,
          FeatureType.Chat,
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
        folder.id !== payload.folderId
          ? folder
          : { ...folder, name, id: constructPath(folder.folderId, name) },
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
      state.folders = combineEntities(state.folders, payload.folders);
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
        isContinue?: boolean;
      }>,
    ) => state,
    replayConversation: (
      state,
      {
        payload,
      }: PayloadAction<{
        conversationId: string;
        isRestart?: boolean;
        isContinue?: boolean;
        activeReplayIndex: number;
      }>,
    ) => {
      state.isReplayPaused = false;
      if (!payload.isRestart && !payload.isContinue) {
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
      }
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
    setIsReplayRequiresVariables: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.isReplayRequiresVariables = payload;
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
      { payload }: PayloadAction<{ ids: string[] }>,
    ) => {
      state.foldersStatus = UploadStatus.LOADING;
      state.loadingFolderIds = state.loadingFolderIds.concat(
        payload.ids as string[],
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
    initConversationsRecursive: (state) => {
      state.conversationsStatus = UploadStatus.LOADING;
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
      state.conversationsLoaded = !!payload?.noLoader;
    },
    uploadConversationsWithContentRecursive: (
      state,
      _action: PayloadAction<{ path: string }>,
    ) => state,
    uploadConversationsWithFoldersRecursiveSuccess: (state) => {
      state.conversationsLoaded = true;
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
    getCustomAttachmentData: (
      state,
      _action: PayloadAction<{
        pathToAttachment: string;
      }>,
    ) => {
      state.customAttachmentDataLoading = true;
    },
    getCustomAttachmentDataSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        params: CustomVisualizerData;
        url: string;
      }>,
    ) => {
      state.loadedCustomAttachmentsData =
        state.loadedCustomAttachmentsData.find(
          (attachmentData) => attachmentData.url === payload.url,
        )
          ? state.loadedCustomAttachmentsData
          : [
              ...state.loadedCustomAttachmentsData,
              {
                url: payload.url,
                data: payload.params,
              },
            ];
      state.customAttachmentDataLoading = false;
    },
    cleanupIsolatedConversation: (state) => state,
    uploadChildConversationsWithFoldersSuccess: (
      state,
      {
        payload,
      }: PayloadAction<{
        parentIds: string[];
        folders: FolderInterface[];
        conversations: ConversationInfo[];
      }>,
    ) => {
      state.loadingFolderIds = state.loadingFolderIds.filter(
        (id) => !payload.parentIds.includes(id),
      );
      state.folders = combineEntities(
        state.folders,
        payload.folders.map((folder) => ({
          ...folder,
          status: payload.parentIds.includes(folder.id)
            ? UploadStatus.LOADED
            : undefined,
        })),
      );
      state.conversations = combineEntities(
        state.conversations,
        payload.conversations,
      );
    },
    setChosenConversation: (
      state,
      {
        payload: { conversationId, isChosen },
      }: PayloadAction<{ conversationId: string; isChosen: boolean }>,
    ) => {
      if (isChosen) {
        const parentFolderIds = state.chosenFolderIds.filter((folderId) =>
          conversationId.startsWith(folderId),
        );
        if (parentFolderIds.length) {
          state.chosenFolderIds = uniq([
            ...state.chosenFolderIds.filter(
              (folderId) => !conversationId.startsWith(folderId),
            ),
            ...state.folders
              .map((folder) => `${folder.id}/`)
              .filter(
                (folderId) =>
                  !conversationId.startsWith(folderId) &&
                  parentFolderIds.some((parentId) =>
                    folderId.startsWith(parentId),
                  ) &&
                  state.conversations
                    .filter((conv) =>
                      doesEntityContainSearchTerm(conv, state.searchTerm),
                    )
                    .some((conv) => conv.id.startsWith(folderId)),
              ),
          ]);
          state.chosenConversationIds = uniq([
            ...state.chosenConversationIds.filter(
              (convId: string) => convId !== conversationId,
            ),
            ...state.conversations
              .filter(
                (conv) =>
                  conv.id !== conversationId &&
                  parentFolderIds.some((parentId) =>
                    conv.id.startsWith(parentId),
                  ) &&
                  doesEntityContainSearchTerm(conv, state.searchTerm),
              )
              .map((conv) => conv.id),
          ]);
        } else {
          state.chosenConversationIds = state.chosenConversationIds.filter(
            (convId: string) => convId !== conversationId,
          );
        }
      } else {
        state.chosenConversationIds = uniq([
          ...state.chosenConversationIds,
          conversationId,
        ]);
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds,
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (folderId) =>
                conversationId.startsWith(folderId) &&
                !state.conversations.some(
                  (conv) =>
                    conv.id.startsWith(folderId) &&
                    !state.chosenConversationIds.includes(conv.id) &&
                    !state.chosenFolderIds.some((chosenFolderId) =>
                      conv.id.startsWith(chosenFolderId),
                    ),
                ),
            ),
        ]);
      }
    },
    setChosenFolder: (
      state,
      {
        payload: { folderId, isChosen },
      }: PayloadAction<{
        folderId: string;
        isChosen: boolean;
      }>,
    ) => {
      if (isChosen) {
        const parentFolderIds = state.chosenFolderIds.filter(
          (chosenId) => folderId.startsWith(chosenId) || chosenId !== folderId,
        );
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds.filter(
            (chosenId) =>
              !folderId.startsWith(chosenId) && !chosenId.startsWith(folderId),
          ),
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (fid) =>
                !fid.startsWith(folderId) &&
                !folderId.startsWith(fid) &&
                parentFolderIds.some((parentId) => fid.startsWith(parentId)),
            ),
        ]);
        state.chosenConversationIds = uniq([
          ...state.chosenConversationIds.filter(
            (convId: string) => !convId.startsWith(folderId),
          ),
          ...state.conversations
            .filter(
              (conv) =>
                doesEntityContainSearchTerm(conv, state.searchTerm) &&
                !conv.id.startsWith(folderId) &&
                parentFolderIds.some((parentId) =>
                  conv.id.startsWith(parentId),
                ),
            )
            .map((c) => c.id),
        ]);
      } else {
        state.chosenConversationIds = state.chosenConversationIds.filter(
          (convId: string) => !convId.startsWith(folderId),
        );
        state.chosenFolderIds = uniq([
          ...state.chosenFolderIds.filter(
            (chosenId) => !chosenId.startsWith(folderId),
          ),
          folderId,
          ...state.folders
            .map((folder) => `${folder.id}/`)
            .filter(
              (fid) =>
                folderId.startsWith(fid) &&
                !state.conversations
                  .filter((conv) =>
                    doesEntityContainSearchTerm(conv, state.searchTerm),
                  )
                  .some(
                    (conv) =>
                      conv.id.startsWith(fid) &&
                      !conv.id.startsWith(folderId) &&
                      !state.chosenConversationIds.includes(conv.id) &&
                      !state.chosenFolderIds.some((chosenFolderId) =>
                        conv.id.startsWith(chosenFolderId),
                      ),
                  ),
            ),
        ]);
      }
    },
    resetChosenConversations: (state) => {
      state.chosenConversationIds = [];
      state.chosenFolderIds = [];
    },
    setAllChosenConversations: (state) => {
      if (state.searchTerm) {
        state.chosenConversationIds = state.conversations
          .filter(
            (conv) =>
              !isEntityExternal(conv) &&
              doesEntityContainSearchTerm(conv, state.searchTerm),
          )
          .map(({ id }) => id);
      } else {
        state.chosenConversationIds = state.conversations
          .filter(
            (conv) =>
              !isEntityExternal(conv) && isRootConversationsId(conv.folderId),
          )
          .map(({ id }) => id);
        state.chosenFolderIds = state.folders
          .filter(
            (folder) =>
              !isEntityExternal(folder) &&
              isRootConversationsId(folder.folderId),
          )
          .map(({ id }) => `${id}/`);
      }
    },
    deleteChosenConversations: (state) => state,
  },
});

export const ConversationsActions = conversationsSlice.actions;
