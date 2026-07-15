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

export const getConversation = (
  conversationPath: string,
  signal?: AbortSignal,
) =>
  conversationsApi.getConversation(
    { path: conversationPath },
    ...(signal ? [{ signal }] : []),
  );

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

export const listConversations = (
  params?: {
    limit?: number;
    nextToken?: string;
    path?: string;
  },
  signal?: AbortSignal,
) =>
  conversationsApi.listConversations(
    {
      limit: params?.limit ?? 1000,
      nextToken: params?.nextToken,
      path: params?.path,
    },
    ...(signal ? [{ signal }] : []),
  );

export const renameConversation = (path: string, newTitle: string) =>
  conversationsApi.renameConversation({
    path,
    renameConversationBodyDto: { newTitle },
  });

export const generateConversationTitle = (conversationPath: string) =>
  conversationsApi.generateConversationTitle({ path: conversationPath });

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

export const watchConversation = async (
  conversationPath: string,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> => {
  const apiResponse = await conversationsApi.watchConversationRaw(
    { watchConversationBodyDto: { path: conversationPath } },
    signal ? { signal } : undefined,
  );
  if (!apiResponse.raw.body) {
    throw new Error('Watch endpoint returned no response body');
  }
  return apiResponse.raw.body as ReadableStream<Uint8Array>;
};
