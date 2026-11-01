import { useCreateProject as useSharedCreateProject } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

export type { CreateProjectOutcome } from '@epam/ai-dial-chat-hooks/project';

/** App adapter of the shared `useCreateProject` over the app's project requests. */
export const useCreateProject = () => useSharedCreateProject(projectsClient);
