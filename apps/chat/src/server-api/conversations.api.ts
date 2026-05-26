import type { ApiAttachment } from '@epam/ai-dial-chat-shared';
import type {
  AttachmentDto,
  ConversationResponseDto,
} from '@epam/chat-api-client';
import { conversationsApi } from './api-client';

export const createConversation = (
  firstMessage: string,
  attachments?: ApiAttachment[],
) =>
  conversationsApi.createConversation({
    createConversationDto: {
      firstMessage,
      ...(attachments?.length
        ? { attachments: attachments as AttachmentDto[] }
        : {}),
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
