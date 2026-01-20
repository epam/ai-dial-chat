import { IconPlayerPlay } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationId,
  isConversationId,
  isPromptId,
} from '@/src/utils/app/id';

import { ResourceToReview } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ConversationsActions,
  PromptsActions,
  PublicationActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { TEntity } from './view-props';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props<TEntity> {
  entity: TEntity;
  children?: React.ReactNode;
  controlsClassNames?: string;
}

interface ViewProps extends Props<TEntity> {
  resourceToReview: ResourceToReview;
}

function PublicationControlsView({
  entity,
  resourceToReview,
  children,
  controlsClassNames,
}: ViewProps) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isMessageStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

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
      PromptsActions.selectPrompt({
        promptId: undefined,
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
      PublicationActions.selectPublication(resourceToReview.publicationUrl),
    );
    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [],
      }),
    );
  }, [dispatch, resourceToReview.publicationUrl]);

  const unselectApplication = useCallback(() => {
    dispatch(PublicationActions.setIsApplicationReview(false));
  }, [dispatch]);

  const unselectToolset = useCallback(() => {
    dispatch(PublicationActions.setIsToolsetReview(false));
  }, [dispatch]);

  const toggleResource = useCallback(
    (offset: number) => {
      const reviewUrl = resourcesToReview[publicationIdx + offset].reviewUrl;

      if (isConversationId(reviewUrl)) {
        unselectPrompt();
        unselectApplication();
        unselectToolset();
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [reviewUrl],
          }),
        );
      } else if (isPromptId(reviewUrl)) {
        unselectConversation();
        unselectApplication();
        unselectToolset();
        dispatch(
          PromptsActions.selectPrompt({
            promptId: reviewUrl,
            isApproveRequiredResource: true,
          }),
        );
        dispatch(PromptsActions.setIsPromptModalOpen({ isOpen: true }));
      } else if (isApplicationId(reviewUrl)) {
        unselectConversation();
        unselectPrompt();
        unselectToolset();
        dispatch(
          ApplicationActions.get({
            applicationId: reviewUrl,
          }),
        );
        dispatch(PublicationActions.setIsApplicationReview(true));
      } else {
        unselectConversation();
        unselectPrompt();
        unselectApplication();
        dispatch(PublicationActions.setIsToolsetReview(true));
      }
    },
    [
      resourcesToReview,
      publicationIdx,
      unselectPrompt,
      unselectApplication,
      unselectToolset,
      dispatch,
      unselectConversation,
    ],
  );

  const handleBackToPublication = useCallback(() => {
    if (isConversationId(resourceToReview.reviewUrl)) {
      unselectConversation();
    } else if (isPromptId(resourceToReview.reviewUrl)) {
      unselectPrompt();
    } else if (isApplicationId(resourceToReview.reviewUrl)) {
      unselectApplication();
    } else {
      unselectToolset();
    }
  }, [
    resourceToReview.reviewUrl,
    unselectConversation,
    unselectPrompt,
    unselectApplication,
    unselectToolset,
  ]);

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
      data-qa="chat-review-container"
    >
      <DialNeutralButton
        data-qa="prev-chat-review-button"
        disabled={publicationIdx === 0}
        onClick={() => toggleResource(-1)}
        iconAfter={
          <IconPlayerPlay
            className="shrink-0 rotate-180"
            height={18}
            width={18}
          />
        }
      />
      <DialNeutralButton
        data-qa="next-chat-review-button"
        disabled={publicationIdx === resourcesToReview.length - 1}
        onClick={() => toggleResource(1)}
        iconBefore={
          <IconPlayerPlay className="shrink-0" height={18} width={18} />
        }
      />
      <DialPrimaryButton
        onClick={handleBackToPublication}
        data-qa="back-to-publication"
        disabled={isMessageStreaming}
        label={t('Back to publication request')}
      />
      {children}
    </div>
  );
}

export function PublicationControls<T extends TEntity>({
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
