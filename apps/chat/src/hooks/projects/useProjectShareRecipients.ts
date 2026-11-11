import {
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

/** Binds reusable recipient state to the app's configured client. */
export const useProjectShareRecipients = () =>
  useSharedProjectShareRecipients(projectSharingClient);
