import type {
  AttachmentDto,
  ConversationResponseDto,
  ProjectConversationListResponseDto,
  RenameConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import type { ProjectConversationListPage } from '@epam/ai-dial-chat-hooks/project';
import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { projectsRequests } from './projects.api';

export { splitProjectConversationId } from '@epam/ai-dial-chat-hooks/project';

/** Lists a page of a project's conversations, newest first. */
export const listProjectConversations = (
  projectId: string,
  signal?: AbortSignal,
  page?: ProjectConversationListPage,
): Promise<ProjectConversationListResponseDto> =>
  projectsRequests.listProjectConversations(projectId, signal, page);

/** Creates a project conversation from its first message, with the fields a top-level create sends. */
export const createProjectConversation = (
  projectId: string,
  firstMessage: string,
  deploymentId: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
  formValue?: Record<string, unknown>,
  skills?: RequestSkill[],
): Promise<ConversationResponseDto> =>
  projectsRequests.createProjectConversation(projectId, {
    firstMessage,
    deploymentId,
    attachments,
    configurationValue,
    formValue,
    skills,
  });

/** Reads a project conversation by its id. */
export const getProjectConversation = (
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationResponseDto> =>
  projectsRequests.getProjectConversation(conversationId, signal);

/** Saves a project conversation by its id. */
export const saveProjectConversation = (
  conversationId: string,
  conversation: ConversationResponseDto,
): Promise<ConversationResponseDto> =>
  projectsRequests.saveProjectConversation(conversationId, conversation);

/** Renames a project conversation; its file name does not change. */
export const renameProjectConversation = (
  conversationId: string,
  newTitle: string,
): Promise<RenameConversationResponseDto> =>
  projectsRequests.renameProjectConversation(conversationId, newTitle);

/** Deletes a project conversation. */
export const deleteProjectConversation = (
  conversationId: string,
): Promise<void> => projectsRequests.deleteProjectConversation(conversationId);

/** Attaches to a project conversation's active generation; `path` is the id without `projects/`. */
export const attachToProjectGeneration = (
  projectId: string,
  path: string,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> =>
  projectsRequests.attachToProjectGeneration(projectId, path, signal);
