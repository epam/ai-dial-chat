import { IconPlayerPlay } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isConversationId } from '@/src/utils/app/id';

import { ConversationInfo } from '@/src/types/chat';
import { PromptInfo } from '@/src/types/prompt';
import { ResourceToReview } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { ScrollDownButton } from '../../Common/ScrollDownButton';

interface Props<T extends PromptInfo | ConversationInfo> {
  entity: T;
  showScrollDownButton?: boolean;
  wrapperClassName?: string;
  onScrollDownClick?: () => void;
}

export function PublicationControlsView<
  T extends PromptInfo | ConversationInfo,
>({
  entity,
  resourceToReview,
  showScrollDownButton,
  onScrollDownClick,
}: Props<T> & { resourceToReview: ResourceToReview }) {
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

  const toggleResource = useCallback(
    (offset: number) => {
      if (isConversationId(resourceToReview.reviewUrl)) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [
              resourcesToReview[publicationIdx + offset].reviewUrl,
            ],
          }),
        );
      } else {
        dispatch(
          PromptsActions.uploadPrompt({
            promptId: resourcesToReview[publicationIdx + offset].reviewUrl,
          }),
        );
        dispatch(
          PromptsActions.setSelectedPrompt({
            promptId: resourcesToReview[publicationIdx + offset].reviewUrl,
            isApproveRequiredResource: true,
          }),
        );
      }
    },
    [dispatch, publicationIdx, resourceToReview.reviewUrl, resourcesToReview],
  );

  useEffect(() => {
    if (!resourceToReview.reviewed) {
      dispatch(
        PublicationActions.markResourceAsReviewed({
          id: entity.id,
        }),
      );
    }
  }, [entity, resourceToReview, dispatch]);

  return (
    <div className="flex justify-center">
      <div className="relative mx-2 mb-2 mt-5 flex w-full flex-row items-center justify-center gap-3 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl">
        <button
          className={classNames(
            'button flex size-[38px] items-center justify-center border-primary bg-layer-2 p-3 outline-none disabled:cursor-not-allowed disabled:bg-layer-2',
            publicationIdx !== 0 && 'hover:bg-layer-4',
          )}
          data-qa="prev-chat-review-button"
          disabled={publicationIdx === 0}
          onClick={() => toggleResource(-1)}
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
          onClick={() => toggleResource(1)}
        >
          <span>
            <IconPlayerPlay height={18} width={18} />
          </span>
        </button>
        <button
          onClick={() => {
            if (isConversationId(resourceToReview.reviewUrl)) {
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
            } else {
              dispatch(
                PromptsActions.setSelectedPrompt({
                  promptId: undefined,
                }),
              );
              dispatch(
                PromptsActions.setIsEditModalOpen({
                  isOpen: false,
                  isPreview: false,
                }),
              );
            }
          }}
          className="button button-primary flex max-h-[38px] items-center"
        >
          {t('Back to publication request')}
        </button>
        {showScrollDownButton && onScrollDownClick && (
          <ScrollDownButton
            className="-top-16 right-0 md:-top-20"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
    </div>
  );
}

export function PublicationControls<T extends PromptInfo | ConversationInfo>({
  entity,
  ...props
}: Props<T>) {
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, entity.id),
  );

  if (!resourceToReview) {
    return null;
  }

  return (
    <PublicationControlsView
      resourceToReview={resourceToReview}
      entity={entity}
      {...props}
    />
  );
}
