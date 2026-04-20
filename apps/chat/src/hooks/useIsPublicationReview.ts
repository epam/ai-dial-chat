import { useMemo } from 'react';

import { AuthSelectors } from '@/src/store/auth/auth.selectors';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';
import { ApplicationSelectors, ToolsetSelectors } from '@/src/store/selectors';

export const useIsPublicationReview = () => {
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const resourcesToReview = useAppSelector(
    PublicationSelectors.selectResourcesToReview,
  );
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const application = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const toolset = useAppSelector(ToolsetSelectors.selectToolsetDetails);

  const isReviewEntity = useMemo(
    () =>
      resourcesToReview.some(
        (r) =>
          selectedConversationIds.includes(r.reviewUrl) ||
          application?.id === r.reviewUrl ||
          toolset?.id === r.reviewUrl,
      ),
    [application?.id, resourcesToReview, selectedConversationIds, toolset?.id],
  );

  return isAdmin && isReviewEntity;
};
