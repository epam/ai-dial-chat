import type {
  CreateProjectResponseDto,
  ListProjectsResponseDto,
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
