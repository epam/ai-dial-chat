import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  NegativeFeedbackCategory,
  NegativeFeedbackModal,
  type NegativeFeedbackModalLabels,
} from '@epam/ai-dial-conversation-messages';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  RateI18nKeys,
} from '../../../constants/translation-keys';
import { useUiFeature } from '../../../hooks/useUiFeature';

interface Props {
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

/** Feeds translated copy and the dislike-comment feature flag into the lib's negative feedback popup. */
const NegativeFeedbackModalContainer: FC<Props> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation();
  const isDislikeCommentEnabled = useUiFeature(OverlayFeature.DislikeComment);

  const labels = useMemo<NegativeFeedbackModalLabels>(
    () => ({
      title: t(RateI18nKeys.NegativeFeedbackTitle),
      feedbackTypeLabel: t(RateI18nKeys.FeedbackTypeLabel),
      selectPlaceholder: t(ButtonsI18nKeys.Select),
      commentPlaceholder: t(RateI18nKeys.FeedbackCommentPlaceholder),
      sendLabel: t(ButtonsI18nKeys.Send),
      categoryLabels: {
        [NegativeFeedbackCategory.UiBug]: t(RateI18nKeys.FeedbackCategoryUiBug),
        [NegativeFeedbackCategory.OveractiveRefusal]: t(
          RateI18nKeys.FeedbackCategoryOveractiveRefusal,
        ),
        [NegativeFeedbackCategory.IncompleteResponse]: t(
          RateI18nKeys.FeedbackCategoryIncompleteResponse,
        ),
        [NegativeFeedbackCategory.ShouldHaveTriggeredThinking]: t(
          RateI18nKeys.FeedbackCategoryShouldHaveTriggeredThinking,
        ),
        [NegativeFeedbackCategory.ShouldHaveSearchedTheWeb]: t(
          RateI18nKeys.FeedbackCategoryShouldHaveSearchedTheWeb,
        ),
      },
    }),
    [t],
  );

  return (
    <NegativeFeedbackModal
      onClose={onClose}
      onSubmit={onSubmit}
      isCommentEnabled={isDislikeCommentEnabled}
      labels={labels}
    />
  );
};

export default memo(NegativeFeedbackModalContainer);
