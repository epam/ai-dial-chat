import { PayloadAction, createSelector, createSlice } from '@reduxjs/toolkit';

import { RootState } from '../index';

import { Feature } from '@epam/ai-dial-shared';

type WithRequestId<T> = T & { requestId: string };

// TODO: Move OverlayOptions to npm package as (OverlayEvents and OverlayRequest)
export interface OverlayOptions {
  hostDomain: string;

  theme?: string;
  modelId?: string;

  enabledFeatures?: Feature[] | string;
}

export interface SendMessageOptions {
  content: string;
}

export interface SetOverlayContextOptions {
  overlayContext: string;
}

interface OverlayState {
  hostDomain: string;

  overlayContext: string | null;
}

const initialState: OverlayState = {
  hostDomain: '*',

  overlayContext: null,
};

export const overlaySlice = createSlice({
  name: 'overlay-events',
  initialState,
  reducers: {
    getMessages: (state, _action: PayloadAction<WithRequestId<object>>) =>
      state,
    setOverlayOptions: (
      state,
      { payload }: PayloadAction<WithRequestId<OverlayOptions>>,
    ) => {
      state.hostDomain = payload.hostDomain;
    },
    setOverlayOptionsSuccess: (
      state,
      _action: PayloadAction<WithRequestId<{ hostDomain: string }>>,
    ) => state,
    setOverlayContext: (
      state,
      { payload }: PayloadAction<WithRequestId<SetOverlayContextOptions>>,
    ) => {
      state.overlayContext = payload.overlayContext;
    },
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

const selectOverlayContext = createSelector([rootSelector], (state) => {
  return state.overlayContext;
});

export const OverlaySelectors = {
  selectHostDomain,
  selectOverlayContext,
};

export const OverlayActions = overlaySlice.actions;
