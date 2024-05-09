import { IconPlayerPlay } from '@tabler/icons-react';
import { useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ConversationInfo } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

interface Props {
  conversation: ConversationInfo;
  resourceToReview: {
    publicationUrl: string;
    reviewed: boolean;
    reviewUrl: string;
  };
}

export default function PublicationChatControls({
  conversation,
  resourceToReview,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const resourcesToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourcesToReviewByPublicationUrl(
      state,
      resourceToReview.publicationUrl,
    ),
  );
  const publicationIdx = resourcesToReview.findIndex(
    (r) => r.reviewUrl === resourceToReview.reviewUrl,
  );

  useEffect(() => {
    if (!resourceToReview.reviewed) {
      dispatch(
        PublicationActions.markResourceAsReviewed({
          id: conversation.id,
        }),
      );
    }
  }, [conversation, resourceToReview, dispatch]);

  return (
    <div className="!-top-10 flex h-[38px] w-full justify-center">
      <div className="flex justify-center gap-3">
        <button
          className={classNames(
            'button flex size-[38px] items-center justify-center border-primary bg-layer-2 p-3 outline-none disabled:cursor-not-allowed disabled:bg-layer-2',
            publicationIdx !== 0 && 'hover:bg-layer-4',
          )}
          data-qa="prev-chat-review-button"
          disabled={publicationIdx === 0}
          onClick={() =>
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [
                  resourcesToReview[publicationIdx - 1].reviewUrl,
                ],
              }),
            )
          }
        >
          <span>
            <IconPlayerPlay className="rotate-180" height={18} width={18} />
          </span>
        </button>
        <button
          className={classNames(
            'button flex size-[38px] items-center justify-center border-primary bg-layer-2 p-3 outline-none disabled:cursor-not-allowed disabled:bg-layer-2',
            resourcesToReview.length - 1 && 'hover:bg-layer-4',
          )}
          data-qa="next-chat-review-button"
          disabled={publicationIdx === resourcesToReview.length - 1}
          onClick={() =>
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [
                  resourcesToReview[publicationIdx + 1].reviewUrl,
                ],
              }),
            )
          }
        >
          <span>
            <IconPlayerPlay height={18} width={18} />
          </span>
        </button>
        <button
          onClick={() => {
            dispatch(
              ConversationsActions.selectConversations({
                conversationIds: [],
              }),
            );
            dispatch(
              PublicationActions.uploadPublication({
                url: resourceToReview.publicationUrl,
              }),
            );
          }}
          className="button button-primary flex items-center"
        >
          {t('Back to publication request')}
        </button>
      </div>
    </div>
  );
}
