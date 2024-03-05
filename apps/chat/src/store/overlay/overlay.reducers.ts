import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { RootState } from '../index';

import { ChatOverlayOptions } from '@epam/ai-dial-shared';

type WithRequestId<T> = T & { requestId: string };

export interface SendMessageOptions {
  content: string;
}

export interface SetSystemPromptOptions {
  systemPrompt: string;
}

interface OverlayState {
  hostDomain: string;
}

const initialState: OverlayState = {
  hostDomain: '*',
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
    ) => state,
    setSystemPrompt: (
      state,
      _action: PayloadAction<WithRequestId<SetSystemPromptOptions>>,
    ) => state,
    sendMessage: (
      state,
      _action: PayloadAction<WithRequestId<SendMessageOptions>>,
    ) => state,
  },
});

const rootSelector = (state: RootState): OverlayState => state.overlay;

const selectHostDomain = createSelector([rootSelector], (state) => {
  return state.hostDomain;
});

export const OverlaySelectors = {
  selectHostDomain,
};

export const OverlayActions = overlaySlice.actions;
