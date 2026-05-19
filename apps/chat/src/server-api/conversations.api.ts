import { Conversation } from '@epam/chat-shared';
import { ApiEndpoints, post } from './base';

export const createConversation = (
  firstMessage: string,
): Promise<Conversation> =>
  post<Conversation>(ApiEndpoints.CONVERSATIONS, { firstMessage });
