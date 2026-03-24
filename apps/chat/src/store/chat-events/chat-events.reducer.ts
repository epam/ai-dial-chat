import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { ChatEvent, ChatEventOperations } from '@/src/types/chat-events';

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
    subscribe: (
      state,
      _action: PayloadAction<{ retryAttempt?: number } | undefined>,
    ) => state,
    subscribeFailure: (
      state,
      _action: PayloadAction<{ retryAttempt?: number } | undefined>,
    ) => {
      state.isSubscribed = false;
    },
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
    declineAllEvents: (
      state,
      _action: PayloadAction<{ method: ChatEventOperations }>,
    ) => {
      state.isReporting = true;
    },
    declineAllEventsSuccess: (
      state,
      { payload }: PayloadAction<{ method: ChatEventOperations }>,
    ) => {
      const declinedEvents = Object.values(state.events)
        .filter((event) => event.method === payload.method)
        .map(({ id }) => id);

      state.isReporting = false;
      state.events = omit(state.events, declinedEvents);
    },
    declineAllEventsFailure: (
      state,
      _action: PayloadAction<{ method: ChatEventOperations }>,
    ) => {
      state.isReporting = false;
    },
  },
});

export const ChatEventsActions = chatEventsSlice.actions;
