import { Message } from '../chat';
import { LatestExportConversationsFormat } from '../import-export';
import { OverlayConversation } from './conversation';

export type SendMessageResponse = void;

export type SetSystemPromptResponse = void;

export interface GetMessagesResponse {
  messages: Message[];
}

export interface GetConversationsResponse {
  conversations: OverlayConversation[];
}

export interface GetSelectedConversationsResponse {
  conversations: OverlayConversation[];
}

export interface CreateConversationResponse {
  conversation: OverlayConversation;
}

export interface CreateLocalConversationResponse {
  conversation: OverlayConversation;
}

export interface SelectConversationResponse {
  conversation: OverlayConversation;
}

export interface RenameConversationResponse {
  conversation: OverlayConversation;
}

export interface CreatePlaybackConversationResponse {
  conversation: OverlayConversation;
}

export interface ExportConversationResponse {
  exportConversation: LatestExportConversationsFormat;
}

export interface ImportConversationResponse {
  conversation: OverlayConversation;
}
