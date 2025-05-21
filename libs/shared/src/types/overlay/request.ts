import { LatestExportConversationsFormat } from '../import-export';

export interface SendMessageRequest {
  content: string;
}
export interface SetSystemPromptRequest {
  systemPrompt: string;
}
export interface CreateConversationRequest {
  parentPath?: string | null;
}
export interface SelectConversationRequest {
  id: string;
}
export interface DeleteConversationRequest {
  id: string;
}
export interface RenameConversationRequest {
  id: string;
  newName: string;
}
export interface CreatePlaybackConversationRequest {
  id: string;
}
export interface ExportConversationRequest {
  id: string;
}
export interface ImportConversationRequest {
  importConversation: LatestExportConversationsFormat;
}
