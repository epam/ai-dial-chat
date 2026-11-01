import { useProjectConversations as useSharedProjectConversations } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

/** App adapter of the shared `useProjectConversations` over the app's project requests. */
export const useProjectConversations = (projectId: string | null) =>
  useSharedProjectConversations(projectsClient, projectId);
