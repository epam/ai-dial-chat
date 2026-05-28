import { ChatEvent } from '@/src/types/chat-events';

export interface ChatEventsState {
  initialized: boolean;
  isSubscribed: boolean;
  isSubscribing: boolean;
  isReporting: boolean;
  channelId?: string;
  events: Record<string, ChatEvent>;
}
