import {
  ProjectCreateErrorCode,
  type ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '../api-error/api-error';
import type { ChatSettingsValues } from '../useChatSettingsFormConfig/useChatSettingsFormConfig';
import type {
  ConversationCreateRequest,
  ProjectsApiClient,
} from './projects-api-client';

/** Why creating a project chat failed, as the host explains it. */
export enum ProjectChatCreateFailure {
  /** The project has no room left for another chat. */
  StorageFull = 'storage-full',
  /** Any other failure. */
  Failed = 'failed',
}

/** A failed chat create, classified for the host's message. */
export interface ProjectChatCreateFailureDetails {
  /** Why the create failed. */
  failure: ProjectChatCreateFailure;
  /** Trace id of the failed request, when the response carried one. */
  requestId?: string;
}

/**
 * Creates a project chat from its first message, saves the composer's chat
 * settings onto it, and hands the saved chat to `onCreated` in every case where
 * the chat exists, even when saving the settings fails (the chat exists either
 * way, and opening it avoids a duplicate on retry). A failed save is rethrown
 * after `onCreated` ran; a failed create rejects without calling it.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`.
 * @param projectId - The project's DIAL id.
 * @param request - First message, deployment, attachments, tool configuration, form values and skills.
 * @param settings - System prompt, temperature and response format saved onto the new chat.
 * @param onCreated - Receives the chat with the settings applied, e.g. to open it.
 */
export const createProjectChat = async (
  client: Pick<
    ProjectsApiClient,
    'createProjectConversation' | 'saveProjectConversation'
  >,
  projectId: string,
  request: ConversationCreateRequest,
  settings: ChatSettingsValues,
  onCreated: (saved: ConversationResponseDto) => void,
): Promise<ConversationResponseDto> => {
  const conversation = await client.createProjectConversation(
    projectId,
    request,
  );
  const saved = {
    ...conversation,
    prompt: settings.systemPrompt,
    temperature: settings.temperature,
    responseFormat: settings.responseFormat,
  } as ConversationResponseDto;
  try {
    await client.saveProjectConversation(conversation.id, saved);
  } finally {
    onCreated(saved);
  }
  return saved;
};

/** Classifies a rejected project chat create as storage-full or a plain failure, with its trace id. */
export const classifyProjectChatCreateError = async (
  error: unknown,
): Promise<ProjectChatCreateFailureDetails> => {
  const { code, traceId } = await getApiErrorDetails(error);
  return {
    failure:
      code === ProjectCreateErrorCode.ProjectStorageFull
        ? ProjectChatCreateFailure.StorageFull
        : ProjectChatCreateFailure.Failed,
    requestId: traceId,
  };
};
