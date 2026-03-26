import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.chatEvents;

const selectIsSubscribed = (state: RootState) =>
  rootSelector(state).isSubscribed;

const selectIsReporting = (state: RootState) => rootSelector(state).isReporting;

const selectChannelId = (state: RootState) => rootSelector(state).channelId;

const selectEvents = (state: RootState) => rootSelector(state).events;

const selectEventsList = createSelector([selectEvents], (events) =>
  Object.values(events),
);

export const ChatEventsSelectors = {
  selectIsSubscribed,
  selectChannelId,
  selectEvents,
  selectEventsList,
  selectIsReporting,
};
