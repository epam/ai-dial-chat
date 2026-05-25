import type {
  ConversationResponseDto,
  DialAttachmentDto,
} from '@epam/chat-api-client';
import { conversationsApi } from './api-client';

export const createConversation = (
  firstMessage: string,
  attachments?: DialAttachmentDto[],
) =>
  conversationsApi.createConversation({
    createConversationDto: {
      firstMessage,
      ...(attachments?.length ? { attachments } : {}),
    },
  });

export const getConversation = (conversationPath: string) =>
  conversationsApi.getConversation({ path: conversationPath });

export const saveConversation = (
  conversationPath: string,
  conversation: ConversationResponseDto,
) =>
  conversationsApi.saveConversation({
    path: conversationPath,
    saveConversationBodyDto: { conversation },
  });

export const deleteConversation = (conversationPath: string) =>
  conversationsApi.deleteConversation({ path: conversationPath });

export const getConversationMetadata = (
  conversationPath: string,
  options?: { permissions?: boolean },
) =>
  conversationsApi.getConversationMetadata({
    path: conversationPath,
    permissions: options?.permissions,
  });
