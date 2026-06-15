import type {
  AttachmentDto,
  ConversationResponseDto,
} from '@epam/chat-api-client';
import { conversationsApi } from './api-client';

export const createConversation = (
  firstMessage: string,
  deploymentId: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
  formValue?: Record<string, unknown>,
) =>
  conversationsApi.createConversation({
    createConversationDto: {
      firstMessage,
      deploymentId,
      ...(attachments?.length || configurationValue || formValue
        ? {
            custom_content: {
              ...(attachments?.length ? { attachments } : {}),
              ...(configurationValue
                ? { configuration_value: configurationValue }
                : {}),
              ...(formValue ? { form_value: formValue } : {}),
            },
          }
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

export const listConversations = (params?: {
  limit?: number;
  nextToken?: string;
  path?: string;
}) =>
  conversationsApi.listConversations({
    limit: params?.limit ?? 1000,
    nextToken: params?.nextToken,
    path: params?.path,
  });

export const renameConversation = (path: string, newTitle: string) =>
  conversationsApi.renameConversation({
    path,
    renameConversationBodyDto: { newTitle },
  });

export const duplicateConversation = (conversationPath: string) =>
  conversationsApi.duplicateConversation({ path: conversationPath });

export const deleteConversations = (ids: string[]) =>
  conversationsApi.deleteConversations({
    deleteConversationsBodyDto: { ids },
  });

export const deleteAllConversations = () =>
  conversationsApi.deleteAllConversations({
    deleteAllConversationsBodyDto: { confirm: true },
  });
