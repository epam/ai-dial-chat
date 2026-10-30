import type {
  AttachmentDto,
  ConversationResponseDto,
  CreateConversationDto,
  CreateProjectResponseDto,
  ListProjectsResponseDto,
  ProjectConversationListResponseDto,
  ProjectDetailsDto,
  RenameConversationResponseDto,
  UpdateProjectResponseDto,
} from '@epam/ai-dial-chat-api-client';
import type { RequestSkill } from '@epam/ai-dial-chat-shared';

/** A generated-client `Raw` answer, of which only the native response is read. */
interface RawApiResponse {
  raw: Response;
}

/** Narrow configured generated-client (`ProjectsApi`) surface the project hooks require. */
export interface ProjectsConfiguredClient {
  listProjects: (options?: RequestInit) => Promise<ListProjectsResponseDto>;
  getProject: (
    request: { id: string },
    options?: RequestInit,
  ) => Promise<ProjectDetailsDto>;
  createProject: (
    request: {
      name: string;
      description?: string;
      instructions?: string;
      fileNames?: string;
      files?: Blob[];
    },
    options?: RequestInit,
  ) => Promise<CreateProjectResponseDto>;
  updateProject: (
    request: {
      id: string;
      ifMatch: string;
      name: string;
      description?: string;
      instructions?: string;
      fileNames?: string;
      removedFileNames?: string;
      files?: Blob[];
    },
    options?: RequestInit,
  ) => Promise<UpdateProjectResponseDto>;
  deleteProject: (request: { id: string; ifMatch: string }) => Promise<void>;
  downloadProjectRaw: (
    request: { id: string },
    options?: RequestInit,
  ) => Promise<RawApiResponse>;
  downloadProjectFileRaw: (
    request: { id: string; fileName: string },
    options?: RequestInit,
  ) => Promise<RawApiResponse>;
  listProjectConversations: (
    request: { id: string; limit?: number; offset?: number },
    options?: RequestInit,
  ) => Promise<ProjectConversationListResponseDto>;
  createProjectConversation: (request: {
    id: string;
    createConversationDto: CreateConversationDto;
  }) => Promise<ConversationResponseDto>;
  getProjectConversation: (
    request: { id: string; conversationName: string },
    options?: RequestInit,
  ) => Promise<ConversationResponseDto>;
  saveProjectConversation: (request: {
    id: string;
    conversationName: string;
    saveConversationBodyDto: { conversation: ConversationResponseDto };
  }) => Promise<ConversationResponseDto>;
  renameProjectConversation: (request: {
    id: string;
    conversationName: string;
    renameConversationBodyDto: { newTitle: string };
  }) => Promise<RenameConversationResponseDto>;
  deleteProjectConversation: (request: {
    id: string;
    conversationName: string;
  }) => Promise<void>;
  attachToProjectGenerationRaw: (
    request: { id: string; attachGenerationDto: { path: string } },
    options?: RequestInit,
  ) => Promise<RawApiResponse>;
}

/** Text fields of a project create or edit request. */
export interface ProjectFields {
  /** Project name; also the last path segment of its id. */
  name: string;
  /** Plain-text description. */
  description: string;
  /** Markdown instructions, stored as the `PROJECT.md` body. */
  instructions: string;
}

/** One project edit: the fields, the added files only, the stored files to drop and the loaded version. */
export interface ProjectUpdateRequest {
  /** The project's DIAL id. */
  id: string;
  /** The edited text fields. */
  fields: ProjectFields;
  /** Files added in this edit. */
  newFiles: File[];
  /** Names of the stored context files to remove. */
  removedFileNames: string[];
  /** The loaded project's `contentVersion`; a conversation written meanwhile does not change it. */
  contentVersion: string;
}

/** One page of a project's conversations, newest first. */
export interface ProjectConversationListPage {
  /** Page size, `1..100`; the BFF defaults to 50. */
  limit?: number;
  /** Conversations to skip; the next page starts at the count already loaded. */
  offset?: number;
}

/** The first message of a new top-level or project conversation. */
export interface ConversationCreateRequest {
  /** The first user message. */
  firstMessage: string;
  /** Model or application the conversation starts with. */
  deploymentId: string;
  /** Attachments of the first message. */
  attachments?: AttachmentDto[];
  /** Tool configuration of the first message. */
  configurationValue?: Record<string, unknown>;
  /** Form values of the first message. */
  formValue?: Record<string, unknown>;
  /** Skills requested with the first message. */
  skills?: RequestSkill[];
}

/** App-agnostic project requests over a configured generated client. */
export interface ProjectsApiClient {
  listProjects: (signal?: AbortSignal) => Promise<ListProjectsResponseDto>;
  getProject: (id: string, signal?: AbortSignal) => Promise<ProjectDetailsDto>;
  createProject: (
    fields: ProjectFields,
    files: File[],
    signal?: AbortSignal,
  ) => Promise<CreateProjectResponseDto>;
  updateProject: (
    request: ProjectUpdateRequest,
    signal?: AbortSignal,
  ) => Promise<UpdateProjectResponseDto>;
  deleteProject: (id: string, contentVersion: string) => Promise<void>;
  downloadProjectArchive: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<Response>;
  downloadProjectContextFile: (
    id: string,
    fileName: string,
    signal?: AbortSignal,
  ) => Promise<Response>;
  listProjectConversations: (
    projectId: string,
    signal?: AbortSignal,
    page?: ProjectConversationListPage,
  ) => Promise<ProjectConversationListResponseDto>;
  createProjectConversation: (
    projectId: string,
    request: ConversationCreateRequest,
  ) => Promise<ConversationResponseDto>;
  getProjectConversation: (
    conversationId: string,
    signal?: AbortSignal,
  ) => Promise<ConversationResponseDto>;
  saveProjectConversation: (
    conversationId: string,
    conversation: ConversationResponseDto,
  ) => Promise<ConversationResponseDto>;
  renameProjectConversation: (
    conversationId: string,
    newTitle: string,
  ) => Promise<RenameConversationResponseDto>;
  deleteProjectConversation: (conversationId: string) => Promise<void>;
  attachToProjectGeneration: (
    projectId: string,
    path: string,
    signal?: AbortSignal,
  ) => Promise<ReadableStream<Uint8Array>>;
}

const PROJECTS_SEGMENT = 'projects';
const CONVERSATIONS_SEGMENT = 'conversations';

/**
 * Splits a project conversation id `projects/{bucket}/{projectPath…}/conversations/{name}`
 * into the project id and the conversation file name; `null` for any other id.
 */
export const splitProjectConversationId = (
  conversationId: string,
): { projectId: string; conversationName: string } | null => {
  const segments = conversationId.split('/');
  if (
    segments.length < 5 ||
    segments[0] !== PROJECTS_SEGMENT ||
    segments[segments.length - 2] !== CONVERSATIONS_SEGMENT
  ) {
    return null;
  }
  return {
    projectId: segments.slice(0, -2).join('/'),
    conversationName: segments[segments.length - 1],
  };
};

const requireConversationParts = (conversationId: string) => {
  const parts = splitProjectConversationId(conversationId);
  if (!parts) throw new Error('Not a project conversation id');
  return { id: parts.projectId, conversationName: parts.conversationName };
};

/* Request options only when a signal is given, so a call without one sends exactly its request. */
const withSignal = (signal?: AbortSignal): [RequestInit] | [] =>
  signal ? [{ signal }] : [];

/** The create-conversation body of a first message, the same for a top-level and a project conversation. */
export const buildCreateConversationDto = ({
  firstMessage,
  deploymentId,
  attachments,
  configurationValue,
  formValue,
  skills,
}: ConversationCreateRequest): CreateConversationDto => ({
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

/**
 * Composes the project requests over a configured generated `ProjectsApi`.
 * File names travel as JSON fields, positionally paired with `files`,
 * because the BFF never trusts a multipart part's own filename.
 */
export const createProjectsApiClient = (
  client: ProjectsConfiguredClient,
): ProjectsApiClient => ({
  listProjects: (signal) => client.listProjects(...withSignal(signal)),
  getProject: (id, signal) => client.getProject({ id }, ...withSignal(signal)),
  createProject: ({ name, description, instructions }, files, signal) =>
    client.createProject(
      {
        name,
        description,
        instructions,
        fileNames: JSON.stringify(files.map((file) => file.name)),
        files,
      },
      ...withSignal(signal),
    ),
  updateProject: (
    { id, fields, newFiles, removedFileNames, contentVersion },
    signal,
  ) =>
    client.updateProject(
      {
        id,
        ifMatch: contentVersion,
        name: fields.name,
        description: fields.description,
        instructions: fields.instructions,
        fileNames: JSON.stringify(newFiles.map((file) => file.name)),
        removedFileNames: JSON.stringify(removedFileNames),
        files: newFiles,
      },
      ...withSignal(signal),
    ),
  deleteProject: (id, contentVersion) =>
    client.deleteProject({ id, ifMatch: contentVersion }),
  downloadProjectArchive: async (id, signal) =>
    (await client.downloadProjectRaw({ id }, ...withSignal(signal))).raw,
  downloadProjectContextFile: async (id, fileName, signal) =>
    (
      await client.downloadProjectFileRaw(
        { id, fileName },
        ...withSignal(signal),
      )
    ).raw,
  listProjectConversations: (projectId, signal, page) =>
    client.listProjectConversations(
      { id: projectId, ...page },
      ...withSignal(signal),
    ),
  createProjectConversation: (projectId, request) =>
    client.createProjectConversation({
      id: projectId,
      createConversationDto: buildCreateConversationDto(request),
    }),
  getProjectConversation: (conversationId, signal) =>
    client.getProjectConversation(
      requireConversationParts(conversationId),
      ...withSignal(signal),
    ),
  saveProjectConversation: (conversationId, conversation) =>
    client.saveProjectConversation({
      ...requireConversationParts(conversationId),
      saveConversationBodyDto: { conversation },
    }),
  renameProjectConversation: (conversationId, newTitle) =>
    client.renameProjectConversation({
      ...requireConversationParts(conversationId),
      renameConversationBodyDto: { newTitle },
    }),
  deleteProjectConversation: (conversationId) =>
    client.deleteProjectConversation(requireConversationParts(conversationId)),
  attachToProjectGeneration: async (projectId, path, signal) => {
    const { raw } = await client.attachToProjectGenerationRaw(
      { id: projectId, attachGenerationDto: { path } },
      ...withSignal(signal),
    );
    if (!raw.body) throw new Error('Attach endpoint returned no response body');
    return raw.body as ReadableStream<Uint8Array>;
  },
});
