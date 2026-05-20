import { Conversation, ConversationMetadata } from '@epam/chat-shared';
import { ApiEndpoints, del, get, post, put } from './base';

export const createConversation = (
  firstMessage: string,
): Promise<Conversation> =>
  post<Conversation>(ApiEndpoints.CONVERSATIONS, { firstMessage });

export const getConversation = (
  conversationPath: string,
): Promise<Conversation> =>
  get<Conversation>(
    `${ApiEndpoints.CONVERSATIONS}?path=${encodeURIComponent(conversationPath)}`,
  );

export const saveConversation = (
  conversationPath: string,
  conversation: Conversation,
): Promise<Conversation> => {
  const params = new URLSearchParams({ path: conversationPath });
  return put<Conversation>(
    `${ApiEndpoints.CONVERSATIONS}?${params.toString()}`,
    { conversation },
  );
};

export const deleteConversation = (conversationPath: string): Promise<void> =>
  del(
    `${ApiEndpoints.CONVERSATIONS}?path=${encodeURIComponent(conversationPath)}`,
  );

export const getConversationMetadata = (
  conversationPath: string,
  options?: { permissions?: boolean },
): Promise<ConversationMetadata> => {
  const params = new URLSearchParams({ path: conversationPath });
  if (options?.permissions) {
    params.set('permissions', String(options.permissions));
  }
  return get<ConversationMetadata>(
    `${ApiEndpoints.CONVERSATIONS}/metadata?${params.toString()}`,
  );
};
