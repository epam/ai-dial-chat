import type { ConversationDataSource } from '@epam/ai-dial-chat-hooks/conversation';
import { createProjectConversationDataSource as createSharedProjectConversationDataSource } from '@epam/ai-dial-chat-hooks/project';
import {
  getProjectConversationRoute,
  getProjectViewRoute,
} from '../constants/routes';
import { ProjectsI18nKeys } from '../constants/translation-keys';
import {
  projectsClient,
  projectViewedWriter,
} from '../hooks/projects/projects-client';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from '../server-api/base';

/**
 * The data source of a conversation stored inside a project, bound to the
 * app's project requests, CSRF token store, project stream base path, routes
 * and the viewed-mark queue the project pages share.
 */
export const createProjectConversationDataSource = ({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}): ConversationDataSource =>
  createSharedProjectConversationDataSource({
    projectId,
    canEdit,
    client: projectsClient,
    stream: {
      getCsrfToken,
      setCsrfToken,
      completionsBasePath: `${ApiEndpoints.PROJECTS}/${encodeURIComponent(projectId)}/conversations`,
    },
    routes: {
      getConversationRoute: getProjectConversationRoute,
      getExitRoute: () => getProjectViewRoute(projectId),
    },
    viewedWriter: projectViewedWriter,
    notFoundMessageKey: ProjectsI18nKeys.ChatNotFound,
  });
