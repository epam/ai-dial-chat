import { IconPlayerPlay } from '@tabler/icons-react';
import React, { useCallback, useEffect } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationId,
  isConversationId,
  isPromptId,
} from '@/src/utils/app/id';

import { ScreenState } from '@/src/types/common';
import { ResourceToReview } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ConversationsActions,
  PromptsActions,
  PublicationActions,
  ToolsetActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PublicationSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

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
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const screenState = useScreenState();

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

  const handleClearReviewSelection = useCallback(() => {
    dispatch(
      PublicationActions.selectPublication({
        url: resourceToReview.publicationUrl,
      }),
    );
    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [],
      }),
    );
    dispatch(
      PromptsActions.selectPrompt({
        promptId: undefined,
      }),
    );
    dispatch(PublicationActions.setIsApplicationReview(false));
    dispatch(PublicationActions.setIsToolsetReview(false));
  }, [dispatch, resourceToReview.publicationUrl]);

  const toggleResource = useCallback(
    (offset: number) => {
      const reviewUrl = resourcesToReview[publicationIdx + offset].reviewUrl;

      handleClearReviewSelection();

      if (isConversationId(reviewUrl)) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [reviewUrl],
          }),
        );
      } else if (isPromptId(reviewUrl)) {
        dispatch(
          PromptsActions.selectPrompt({
            promptId: reviewUrl,
            isApproveRequiredResource: true,
          }),
        );
        dispatch(PromptsActions.setIsPromptModalOpen({ isOpen: true }));
      } else if (isApplicationId(reviewUrl)) {
        dispatch(
          ApplicationActions.get({
            applicationId: reviewUrl,
          }),
        );
        dispatch(PublicationActions.setIsApplicationReview(true));
      } else {
        dispatch(ToolsetActions.getToolsetDetails({ id: reviewUrl }));
        dispatch(PublicationActions.setIsToolsetReview(true));
      }
    },
    [resourcesToReview, publicationIdx, handleClearReviewSelection, dispatch],
  );

  const handleToggleNext = useCallback(() => {
    toggleResource(1);
  }, [toggleResource]);

  const handleTogglePrev = useCallback(() => {
    toggleResource(-1);
  }, [toggleResource]);

  useEffect(() => {
    if (!resourceToReview.reviewed) {
      dispatch(
        PublicationActions.markResourceAsReviewed({
          id: entity.id,
          publicationUrl: resourceToReview.publicationUrl,
        }),
      );
    }
  }, [
    entity.id,
    resourceToReview.publicationUrl,
    resourceToReview.reviewed,
    dispatch,
  ]);

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
        onClick={handleTogglePrev}
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
        onClick={handleToggleNext}
        iconBefore={
          <IconPlayerPlay className="shrink-0" height={18} width={18} />
        }
      />
      <DialPrimaryButton
        onClick={handleClearReviewSelection}
        data-qa="back-to-publication"
        disabled={isMessageStreaming}
        label={
          isOverlay || screenState === ScreenState.SM
            ? t(ChatI18nKeys.Back)
            : t(ChatI18nKeys.BackToPublicationRequest)
        }
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
