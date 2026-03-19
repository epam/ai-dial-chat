import { ChatEvent } from '@/src/types/chat-events';

export interface ChatEventsState {
  isSubscribed: boolean;
  isReporting: boolean;
  channelId?: string;
  events: Record<string, ChatEvent>;
}
