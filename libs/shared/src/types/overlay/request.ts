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
