import { Message } from '../chat';
import { OverlayConversation } from './conversation';

export type SendMessageResponse = void;

export type SetSystemPromptResponse = void;

export interface GetMessagesResponse {
  messages: Message[];
}

export interface GetConversationsResponse {
  conversations: OverlayConversation[];
}

export interface CreateConversationResponse {
  conversation: OverlayConversation;
}

export interface SelectConversationResponse {
  conversation: OverlayConversation;
}
