import type { ConversationResponseDto } from '../openapi/openapi-response.dto';

export interface ConversationPersistencePort {
  getConversation(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<ConversationResponseDto>;

  saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto>;
}

export const CONVERSATION_PERSISTENCE = Symbol('CONVERSATION_PERSISTENCE');
