import type {
  AttachmentDto,
  ConversationResponseDto,
  ConversationTitleStreamEventDto,
  CreateConversationDto,
} from '@epam/ai-dial-chat-api-client';
import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { conversationsApi } from './api-client';
import {
  ConversationTitleStreamProtocolError,
  readConversationTitleStream,
} from './conversation-title-stream';

/**
 * The body of a create-conversation request, shared by top-level and
 * project conversations so both send the same first-message fields.
 */
export const buildCreateConversationDto = (
  firstMessage: string,
  deploymentId: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
  formValue?: Record<string, unknown>,
  skills?: RequestSkill[],
): CreateConversationDto => ({
  firstMessage,
  deploymentId,
  ...(attachments?.length || configurationValue || formValue || skills?.length
    ? {
        custom_content: {
          ...(attachments?.length ? { attachments } : {}),
          ...(configurationValue
            ? { configuration_value: configurationValue }
            : {}),
          ...(formValue ? { form_value: formValue } : {}),
          ...(skills?.length ? { skills } : {}),
        },
      }
    : {}),
});

export const createConversation = (
  firstMessage: string,
  deploymentId: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
  formValue?: Record<string, unknown>,
  skills?: RequestSkill[],
) =>
  conversationsApi.createConversation({
    createConversationDto: buildCreateConversationDto(
      firstMessage,
      deploymentId,
      attachments,
      configurationValue,
      formValue,
      skills,
    ),
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
  signal?: AbortSignal,
) =>
  conversationsApi.saveConversation(
    {
      path: conversationPath,
      saveConversationBodyDto: { conversation },
    },
    ...(signal ? [{ signal }] : []),
  );

export const deleteConversation = (conversationPath: string) =>
  conversationsApi.deleteConversation({ path: conversationPath });

export const markConversationViewed = (conversationPath: string) =>
  conversationsApi.markConversationViewed({ path: conversationPath });

export const listConversations = (
  params?: {
    limit?: number;
    nextToken?: string;
  },
  signal?: AbortSignal,
) =>
  conversationsApi.listConversations(
    {
      limit: params?.limit,
      nextToken: params?.nextToken,
    },
    ...(signal ? [{ signal }] : []),
  );

export const getConversationTitles = (ids: string[], signal?: AbortSignal) =>
  conversationsApi.getConversationTitles(
    { conversationTitlesBodyDto: { ids } },
    ...(signal ? [{ signal }] : []),
  );

/**
 * Opens the finite title stream. Rejects (via the generated client's
 * `ResponseError`) before any event when the backend answers non-2xx; the
 * returned iterable yields validated events and owns the response reader.
 */
export const streamConversationTitles = async (
  ids: string[],
  signal?: AbortSignal,
): Promise<AsyncIterable<ConversationTitleStreamEventDto>> => {
  const apiResponse = await conversationsApi.streamConversationTitlesRaw(
    { streamConversationTitlesBodyDto: { ids } },
    signal ? { signal } : undefined,
  );
  if (!apiResponse.raw.body) {
    throw new ConversationTitleStreamProtocolError(
      'Title stream returned no response body',
    );
  }
  return readConversationTitleStream(apiResponse.raw.body);
};

export const renameConversation = (path: string, newTitle: string) =>
  conversationsApi.renameConversation({
    path,
    renameConversationBodyDto: { newTitle },
  });

export const generateConversationTitle = (conversationPath: string) =>
  conversationsApi.generateConversationTitle({ path: conversationPath });

export const duplicateConversation = (conversationPath: string) =>
  conversationsApi.duplicateConversation({ path: conversationPath });

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

/**
 * Attaches to an active generation's live replay stream. Rejects (via the
 * generated client's `ResponseError`) when the backend responds non-2xx —
 * including 404 for "no active generation" — so the caller can fall back to
 * the terminal-update watch instead.
 */
export const attachToGeneration = async (
  conversationPath: string,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> => {
  const apiResponse = await conversationsApi.attachToGenerationRaw(
    { attachGenerationDto: { path: conversationPath } },
    signal ? { signal } : undefined,
  );
  if (!apiResponse.raw.body) {
    throw new Error('Attach endpoint returned no response body');
  }
  return apiResponse.raw.body as ReadableStream<Uint8Array>;
};
