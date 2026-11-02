import {
  type ProjectWatchOptions,
  useProjectWatch as useSharedProjectWatch,
} from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

/** App adapter of the shared `useProjectWatch` over the app's project requests. */
export const useProjectWatch = (
  projectId: string | null,
  options: ProjectWatchOptions,
) => useSharedProjectWatch(projectsClient, projectId, options);
