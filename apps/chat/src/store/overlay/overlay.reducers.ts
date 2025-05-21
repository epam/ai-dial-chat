import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  PostMessageEventParams,
  PostMessageRequestParams,
} from '@/src/utils/app/overlay';

import { OverlayState } from './overlay.types';

import {
  ChatOverlayOptions,
  CreateConversationRequest,
  CreatePlaybackConversationRequest,
  DeleteConversationRequest,
  ExportConversationRequest,
  ImportConversationRequest,
  OverlayEvents,
  OverlayRequests,
  RenameConversationRequest,
  SelectConversationRequest,
  SendMessageRequest,
  SetSystemPromptRequest,
} from '@epam/ai-dial-shared';

type WithRequestId<T> = T & { requestId: string };

const initialState: OverlayState = {
  hostDomain: '*',

  systemPrompt: null,
  newConversationsFolder: null,
  readyToInteractSent: false,
};

export const overlaySlice = createSlice({
  name: 'overlay-events',
  initialState,
  reducers: {
    getMessages: (state, _action: PayloadAction<WithRequestId<object>>) =>
      state,
    getConversations: (state, _action: PayloadAction<WithRequestId<object>>) =>
      state,
    getSelectedConversations: (
      state,
      _action: PayloadAction<WithRequestId<object>>,
    ) => state,
    setSystemPrompt: (
      state,
      { payload }: PayloadAction<WithRequestId<SetSystemPromptRequest>>,
    ) => {
      state.systemPrompt = payload.systemPrompt;
    },
    selectConversation: (
      state,
      _action: PayloadAction<WithRequestId<SelectConversationRequest>>,
    ) => state,
    deleteConversation: (
      state,
      _action: PayloadAction<WithRequestId<DeleteConversationRequest>>,
    ) => state,
    renameConversation: (
      state,
      _action: PayloadAction<WithRequestId<RenameConversationRequest>>,
    ) => state,
    renameConversationEffect: (
      state,
      _action: PayloadAction<WithRequestId<RenameConversationRequest>>,
    ) => state,
    createPlaybackConversation: (
      state,
      _action: PayloadAction<WithRequestId<CreatePlaybackConversationRequest>>,
    ) => state,
    createPlaybackConversationEffect: (
      state,
      _action: PayloadAction<WithRequestId<CreatePlaybackConversationRequest>>,
    ) => state,
    exportConversation: (
      state,
      _action: PayloadAction<WithRequestId<ExportConversationRequest>>,
    ) => state,
    importConversation: (
      state,
      _action: PayloadAction<WithRequestId<ImportConversationRequest>>,
    ) => state,
    importConversationEffect: (
      state,
      _action: PayloadAction<WithRequestId<ImportConversationRequest>>,
    ) => state,
    createConversation: (
      state,
      _action: PayloadAction<WithRequestId<CreateConversationRequest>>,
    ) => state,
    createConversationEffect: (
      state,
      _action: PayloadAction<WithRequestId<CreateConversationRequest>>,
    ) => state,
    setOverlayOptions: (
      state,
      { payload }: PayloadAction<WithRequestId<ChatOverlayOptions>>,
    ) => {
      state.hostDomain = payload.hostDomain;
      state.newConversationsFolder = payload.newConversationsFolderId ?? null;
    },
    setOverlayOptionsSuccess: (
      state,
      _action: PayloadAction<WithRequestId<{ hostDomain: string }>>,
    ) => {
      state.optionsReceived = true;
    },
    signInOptionsSet: (
      state,
      _action: PayloadAction<{
        signInOptions: ChatOverlayOptions['signInOptions'];
      }>,
    ) => state,

    sendMessage: (
      state,
      _action: PayloadAction<WithRequestId<SendMessageRequest>>,
    ) => state,
    sendPMEvent: (
      state,
      _action: PayloadAction<{
        type: OverlayEvents;
        eventParams: PostMessageEventParams;
      }>,
    ) => state,
    sendPMResponse: (
      state,
      _action: PayloadAction<{
        type: OverlayRequests;
        requestParams: PostMessageRequestParams;
      }>,
    ) => state,
    checkReadyToInteract: (state) => state,
    sendReadyToInteract: (state) => {
      state.readyToInteractSent = true;
    },
  },
});

export const OverlayActions = overlaySlice.actions;
