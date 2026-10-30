import { useProject as useSharedProject } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

/** App adapter of the shared `useProject` over the app's project requests. */
export const useProject = (id: string | null, enabled: boolean) =>
  useSharedProject(projectsClient, id, enabled);
