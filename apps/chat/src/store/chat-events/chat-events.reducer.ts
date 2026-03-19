import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ChatEvent } from '@/src/types/chat-events';

import { ChatEventsState } from '@/src/store/chat-events/chat-events.types';

import omit from 'lodash-es/omit';

const initialState: ChatEventsState = {
  isSubscribed: false,
  isReporting: false,
  events: {},
};

export const chatEventsSlice = createSlice({
  name: 'chat-events',
  initialState,
  reducers: {
    subscribe: (state) => state,
    unsubscribe: (state) => state,
    setChannelId: (state, { payload }: PayloadAction<string>) => {
      state.channelId = payload;
    },
    setIsSubscribed: (state, { payload }: PayloadAction<boolean>) => {
      state.isSubscribed = payload;
    },
    addEvent: (state, { payload }: PayloadAction<ChatEvent>) => {
      state.events = {
        ...state.events,
        [payload.id]: payload,
      };
    },
    reportEvent: (state, _action: PayloadAction<ChatEvent>) => {
      state.isReporting = true;
    },
    reportEventSuccess: (state, { payload }: PayloadAction<ChatEvent>) => {
      state.isReporting = false;
      state.events = omit(state.events, payload.id);
    },
    reportEventFailure: (state, _action: PayloadAction<ChatEvent>) => {
      state.isReporting = false;
    },
  },
});

export const ChatEventsActions = chatEventsSlice.actions;
