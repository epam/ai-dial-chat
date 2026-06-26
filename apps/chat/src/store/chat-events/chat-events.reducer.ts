import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import {
  ChatEvent,
  ChatEventOperations,
  ChatEventResult,
} from '@/src/types/chat-events';

import { ChatEventsState } from '@/src/store/chat-events/chat-events.types';

import omit from 'lodash-es/omit';

const initialState: ChatEventsState = {
  initialized: false,
  isSubscribed: false,
  isSubscribing: false,
  isReporting: false,
  events: {},
};

export const chatEventsSlice = createSlice({
  name: 'chat-events',
  initialState,
  reducers: {
    init: (state) => state,
    initFinish: (state) => {
      state.initialized = true;
    },
    subscribe: (
      state,
      _action: PayloadAction<{ retryAttempt?: number } | undefined>,
    ) => {
      state.isSubscribing = true;
    },
    subscribeFailure: (
      state,
      _action: PayloadAction<{ retryAttempt?: number } | undefined>,
    ) => {
      state.isSubscribed = false;
      state.isSubscribing = false;
    },
    unsubscribe: (state) => state,
    setChannelId: (state, { payload }: PayloadAction<string | undefined>) => {
      state.channelId = payload;
      state.isSubscribing = false;
    },
    setIsSubscribed: (state, { payload }: PayloadAction<boolean>) => {
      state.isSubscribed = payload;
      state.isSubscribing = false;
    },
    addEvents: (state, { payload }: PayloadAction<ChatEvent[]>) => {
      const newEvents = { ...state.events };
      payload.forEach((v) => (newEvents[v.id] = v));
      state.events = newEvents;
    },
    reportEvent: (
      state,
      _action: PayloadAction<{ event: ChatEvent; result: ChatEventResult }>,
    ) => {
      state.isReporting = true;
    },
    reportEventSuccess: (
      state,
      { payload }: PayloadAction<{ event: ChatEvent; result: ChatEventResult }>,
    ) => {
      state.isReporting = false;
      state.events = omit(state.events, payload.event.id);
    },
    reportEventFailure: (
      state,
      _action: PayloadAction<{ event: ChatEvent; result: ChatEventResult }>,
    ) => {
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
