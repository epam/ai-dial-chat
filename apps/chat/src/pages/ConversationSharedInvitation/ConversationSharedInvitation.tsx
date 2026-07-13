import { FC, memo } from 'react';
import { getConversationRoute } from '../../constants/routes';
import { ROUTES } from '../../types/routes';
import SharedInvitationPage from '../SharedInvitation/SharedInvitation';

/**
 * Landing route for a conversation share link. Reuses `SharedInvitationPage`
 * for the accept/error handling, but redirects into the conversation view
 * instead of the catalog once accepted.
 */
const ConversationSharedInvitationPage: FC = () => (
  <SharedInvitationPage
    getTargetRoute={getConversationRoute}
    errorFallbackRoute={ROUTES.Root}
  />
);

export default memo(ConversationSharedInvitationPage);
