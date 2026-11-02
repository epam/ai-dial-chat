import { useSaveProject as useSharedSaveProject } from '@epam/ai-dial-chat-hooks/project';
import { projectsClient } from './projects-client';

export type {
  ProjectUpdateRequest as SaveProjectRequest,
  SaveProjectOutcome,
} from '@epam/ai-dial-chat-hooks/project';

/** App adapter of the shared `useSaveProject` over the app's project requests. */
export const useSaveProject = () => useSharedSaveProject(projectsClient);
