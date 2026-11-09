import { ProjectSource } from '@epam/ai-dial-chat-api-client';

/** Whether a project was shared with the current user, so they may drop it from their list but not delete it. */
export const isProjectSharedWithMe = (
  project: { source: ProjectSource; canManage: boolean } | null | undefined,
): boolean =>
  project != null &&
  project.source === ProjectSource.Shared &&
  !project.canManage;
