import { RootState } from '@/src/types/store';

const rootSelector = (state: RootState) => state.chatEvents;

const selectIsSubscribed = (state: RootState) =>
  rootSelector(state).isSubscribed;

const selectChannelId = (state: RootState) => rootSelector(state).channelId;

const selectEvents = (state: RootState) => rootSelector(state).events;

export const ChatEventsSelectors = {
  selectIsSubscribed,
  selectChannelId,
  selectEvents,
};
