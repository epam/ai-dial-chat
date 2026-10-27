import type { ListProjectsResponseDto } from '@epam/ai-dial-chat-api-client';
import { projectsApi } from './api-client';

/** Lists every project visible to the session user, with caller cancellation. */
export const listProjects = ({
  signal,
}: { signal?: AbortSignal } = {}): Promise<ListProjectsResponseDto> =>
  projectsApi.listProjects({ signal });
