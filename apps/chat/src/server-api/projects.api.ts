import type {
  CreateProjectResponseDto,
  ListProjectsResponseDto,
  ProjectDetailsDto,
  UpdateProjectResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { projectsApi } from './api-client';

/** Text fields of a project create request. */
export interface CreateProjectFields {
  name: string;
  description: string;
  instructions: string;
}

/** Lists every project visible to the session user, with caller cancellation. */
export const listProjects = ({
  signal,
}: { signal?: AbortSignal } = {}): Promise<ListProjectsResponseDto> =>
  projectsApi.listProjects({ signal });

/**
 * Creates a project in the session user's bucket. File names travel as the
 * JSON `fileNames` field, positionally paired with `files`, because the BFF
 * never trusts a multipart part's own filename.
 */
export const createProject = (
  { name, description, instructions }: CreateProjectFields,
  files: File[],
  signal?: AbortSignal,
): Promise<CreateProjectResponseDto> =>
  projectsApi.createProject(
    {
      name,
      description,
      instructions,
      fileNames: JSON.stringify(files.map((file) => file.name)),
      files,
    },
    signal ? { signal } : undefined,
  );

/** Reads one project's details by its DIAL id, with caller cancellation. */
export const getProject = (
  id: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ProjectDetailsDto> => projectsApi.getProject({ id }, { signal });

/*
 * The generator types the binary download operations as `Blob | void`, so
 * the `Raw` variants are used and the native `Response` is returned for
 * `triggerBrowserDownload`, as `downloadSkill` does.
 */

/** Downloads a whole project as Core's ZIP archive. */
export const downloadProjectArchive = async (
  id: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const raw = await projectsApi.downloadProjectRaw(
    { id },
    ...(signal ? [{ signal }] : []),
  );
  return raw.raw;
};

/** Downloads one file of a project's context. */
export const downloadProjectContextFile = async (
  id: string,
  fileName: string,
  signal?: AbortSignal,
): Promise<Response> => {
  const raw = await projectsApi.downloadProjectFileRaw(
    { id, fileName },
    ...(signal ? [{ signal }] : []),
  );
  return raw.raw;
};

/** Deletes a project if it is still the version named by `etag`. */
export const deleteProject = (id: string, etag: string): Promise<void> =>
  projectsApi.deleteProject({ id, ifMatch: etag });

/**
 * Saves a project edit in one request: the text fields, the added files
 * only, and the names of the stored files to drop, conditioned on `etag`.
 * File names travel as JSON fields, as on create.
 */
export const updateProject = (
  id: string,
  { name, description, instructions }: CreateProjectFields,
  newFiles: File[],
  removedFileNames: string[],
  etag: string,
  signal?: AbortSignal,
): Promise<UpdateProjectResponseDto> =>
  projectsApi.updateProject(
    {
      id,
      ifMatch: etag,
      name,
      description,
      instructions,
      fileNames: JSON.stringify(newFiles.map((file) => file.name)),
      removedFileNames: JSON.stringify(removedFileNames),
      files: newFiles,
    },
    signal ? { signal } : undefined,
  );
