import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import {
  PostMessageEventParams,
  PostMessageRequestParams,
} from '@/src/utils/app/overlay';

import { RootState } from '../index';

import {
  ChatOverlayOptions,
  OverlayEvents,
  OverlayRequests,
} from '@epam/ai-dial-shared';

type WithRequestId<T> = T & { requestId: string };

export interface SendMessageOptions {
  content: string;
}

export interface SetSystemPromptOptions {
  systemPrompt: string;
}

interface OverlayState {
  hostDomain: string;

  systemPrompt: string | null;

  readyToInteractSent: boolean;
  optionsReceived?: boolean;
}

const initialState: OverlayState = {
  hostDomain: '*',

  systemPrompt: null,
  readyToInteractSent: false,
};

export const overlaySlice = createSlice({
  name: 'overlay-events',
  initialState,
  reducers: {
    getMessages: (state, _action: PayloadAction<WithRequestId<object>>) =>
      state,
    setOverlayOptions: (
      state,
      { payload }: PayloadAction<WithRequestId<ChatOverlayOptions>>,
    ) => {
      state.hostDomain = payload.hostDomain;
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
    setSystemPrompt: (
      state,
      { payload }: PayloadAction<WithRequestId<SetSystemPromptOptions>>,
    ) => {
      state.systemPrompt = payload.systemPrompt;
    },
    sendMessage: (
      state,
      _action: PayloadAction<WithRequestId<SendMessageOptions>>,
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

const rootSelector = (state: RootState): OverlayState => state.overlay;

const selectHostDomain = createSelector([rootSelector], (state) => {
  return state.hostDomain;
});

const selectOverlaySystemPrompt = createSelector([rootSelector], (state) => {
  return state.systemPrompt;
});

const selectOptionsReceived = createSelector([rootSelector], (state) => {
  return state.optionsReceived;
});

const selectReadyToInteractSent = createSelector([rootSelector], (state) => {
  return state.readyToInteractSent;
});

export const OverlaySelectors = {
  selectHostDomain,
  selectOverlaySystemPrompt,
  selectOptionsReceived,
  selectReadyToInteractSent,
};

export const OverlayActions = overlaySlice.actions;
