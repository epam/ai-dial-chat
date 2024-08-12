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
  onScrollDownClick?: () => void;
  controlsClassNames?: string;
}

export function PublicationControlsView<
  T extends PromptInfo | ConversationInfo,
>({
  entity,
  resourceToReview,
  showScrollDownButton,
  onScrollDownClick,
  controlsClassNames,
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
    (res) => res.reviewUrl === resourceToReview.reviewUrl,
  );

  const unselectPrompt = useCallback(() => {
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
    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [],
      }),
    );
  }, [dispatch]);

  const unselectConversation = useCallback(() => {
    dispatch(
      PublicationActions.uploadPublication({
        url: resourceToReview.publicationUrl,
      }),
    );
    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [],
      }),
    );
  }, [dispatch, resourceToReview.publicationUrl]);

  const toggleResource = useCallback(
    (offset: number) => {
      if (
        isConversationId(resourcesToReview[publicationIdx + offset].reviewUrl)
      ) {
        unselectPrompt();
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [
              resourcesToReview[publicationIdx + offset].reviewUrl,
            ],
          }),
        );
      } else {
        unselectConversation();
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
        dispatch(
          PromptsActions.setIsEditModalOpen({
            isOpen: true,
            isPreview: true,
          }),
        );
      }
    },
    [
      dispatch,
      publicationIdx,
      resourcesToReview,
      unselectConversation,
      unselectPrompt,
    ],
  );

  useEffect(() => {
    if (!resourceToReview.reviewed) {
      dispatch(
        PublicationActions.markResourceAsReviewed({
          id: entity.id,
          publicationUrl: resourceToReview.publicationUrl,
        }),
      );
    }
  }, [entity, resourceToReview, dispatch]);

  return (
    <div
      className={classNames(
        'relative flex items-center justify-center gap-3',
        controlsClassNames,
      )}
    >
      <button
        className={classNames(
          'button flex size-[38px] items-center justify-center border-primary bg-layer-2 p-3 outline-none disabled:cursor-not-allowed disabled:bg-layer-2',
          publicationIdx !== 0 && 'hover:bg-layer-4',
        )}
        data-qa="prev-chat-review-button"
        disabled={publicationIdx === 0}
        onClick={() => toggleResource(-1)}
      >
        <IconPlayerPlay
          className="shrink-0 rotate-180"
          height={18}
          width={18}
        />
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
        <IconPlayerPlay className="shrink-0" height={18} width={18} />
      </button>
      <button
        onClick={() =>
          isConversationId(resourceToReview.reviewUrl)
            ? unselectConversation()
            : unselectPrompt()
        }
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
