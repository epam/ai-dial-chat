import {
  notifyProjectAccessRevoked as notifyRevoked,
  useProjectShareRecipients as useSharedProjectShareRecipients,
  type ProjectSharingClient,
} from '@epam/ai-dial-chat-hooks/project';
import {
  getShareRecipientsCount,
  revokeSharedAccess,
} from '../../server-api/share.api';

/** Stable adapter of the app's configured sharing operations. */
export const projectSharingClient: ProjectSharingClient = {
  getShareRecipientsCount: ({ itemId }) => getShareRecipientsCount(itemId),
  revokeSharedAccess: ({ revokeSharedAccessDto }) =>
    revokeSharedAccess(revokeSharedAccessDto.itemId),
};

/** Updates menus using the app's sharing client. */
export const notifyProjectAccessRevoked = (projectId: string) =>
  notifyRevoked(projectSharingClient, projectId);

/** Binds reusable recipient state to the app's configured client. */
export const useProjectShareRecipients = () =>
  useSharedProjectShareRecipients(projectSharingClient);
