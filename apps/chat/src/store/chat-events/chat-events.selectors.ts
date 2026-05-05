import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.chatEvents;

const selectIsInitialized = (state: RootState) =>
  rootSelector(state).initialized;

const selectIsSubscribed = (state: RootState) =>
  rootSelector(state).isSubscribed;

const selectIsSubscribing = (state: RootState) =>
  rootSelector(state).isSubscribing;

const selectIsReporting = (state: RootState) => rootSelector(state).isReporting;

const selectChannelId = (state: RootState) => rootSelector(state).channelId;

const selectEvents = (state: RootState) => rootSelector(state).events;

const selectEventsList = createSelector([selectEvents], (events) =>
  Object.values(events),
);

export const ChatEventsSelectors = {
  selectIsInitialized,
  selectIsSubscribed,
  selectIsSubscribing,
  selectChannelId,
  selectEvents,
  selectEventsList,
  selectIsReporting,
};
