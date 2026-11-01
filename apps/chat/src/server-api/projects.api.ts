import type {
  CreateProjectResponseDto,
  ListProjectsResponseDto,
  ProjectDetailsDto,
  UpdateProjectResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  createProjectsApiClient,
  type ProjectFields,
} from '@epam/ai-dial-chat-hooks/project';
import { projectsApi } from './api-client';

/* The app owns generated-client configuration; chat-hooks owns the project request composition. */
export const projectsRequests = createProjectsApiClient(projectsApi);

/** Text fields of a project create request. */
export type CreateProjectFields = ProjectFields;

/** Lists every project visible to the session user, with caller cancellation. */
export const listProjects = ({
  signal,
}: { signal?: AbortSignal } = {}): Promise<ListProjectsResponseDto> =>
  projectsRequests.listProjects(signal);

/** Creates a project in the session user's bucket. */
export const createProject = (
  fields: CreateProjectFields,
  files: File[],
  signal?: AbortSignal,
): Promise<CreateProjectResponseDto> =>
  projectsRequests.createProject(fields, files, signal);

/** Reads one project's details by its DIAL id, with caller cancellation. */
export const getProject = (
  id: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ProjectDetailsDto> => projectsRequests.getProject(id, signal);

/** Opens the SSE stream of changes to the given projects, with caller cancellation. */
export const watchProjects = (
  ids: string[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> =>
  projectsRequests.watchProjects(ids, signal);

/** Downloads a whole project as Core's ZIP archive. */
export const downloadProjectArchive = (
  id: string,
  signal?: AbortSignal,
): Promise<Response> => projectsRequests.downloadProjectArchive(id, signal);

/** Downloads one file of a project's context. */
export const downloadProjectContextFile = (
  id: string,
  fileName: string,
  signal?: AbortSignal,
): Promise<Response> =>
  projectsRequests.downloadProjectContextFile(id, fileName, signal);

/**
 * Deletes a project, its conversations included, if its content is still the
 * version named by `contentVersion` (from `getProject`, not its `etag`).
 */
export const deleteProject = (
  id: string,
  contentVersion: string,
): Promise<void> => projectsRequests.deleteProject(id, contentVersion);

/**
 * Saves a project edit in one request, conditioned on the loaded
 * `contentVersion`, so a conversation written meanwhile does not fail it.
 */
export const updateProject = (
  id: string,
  fields: CreateProjectFields,
  newFiles: File[],
  removedFileNames: string[],
  contentVersion: string,
  signal?: AbortSignal,
): Promise<UpdateProjectResponseDto> =>
  projectsRequests.updateProject(
    { id, fields, newFiles, removedFileNames, contentVersion },
    signal,
  );
