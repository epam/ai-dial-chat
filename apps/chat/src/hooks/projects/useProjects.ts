import { useProjects as useSharedProjects } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

/** App adapter of the shared `useProjects` over the app's project requests. */
export const useProjects = (enabled: boolean) =>
  useSharedProjects(projectsClient, enabled);
