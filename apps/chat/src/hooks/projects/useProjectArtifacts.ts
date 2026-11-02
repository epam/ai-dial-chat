import { useProjectArtifacts as useSharedProjectArtifacts } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

/** App adapter of the shared `useProjectArtifacts` over the app's project requests. */
export const useProjectArtifacts = (projectId: string | null) =>
  useSharedProjectArtifacts(projectsClient, projectId);
