import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  ButtonVariant,
  Popup,
  PopupSize,
  Select,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FEEDBACK_CATEGORIES } from '../../../constants/feedback-categories';
import {
  ButtonsI18nKeys,
  RateI18nKeys,
} from '../../../constants/translation-keys';
import { useUiFeature } from '../../../hooks/useUiFeature';

interface Props {
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

const NegativeFeedbackModal: FC<Props> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation();
  const isDislikeCommentEnabled = useUiFeature(OverlayFeature.DislikeComment);
  const [category, setCategory] = useState('');
  const [commentText, setCommentText] = useState('');

  const options = useMemo(
    () =>
      FEEDBACK_CATEGORIES.map((categoryOption) => ({
        value: categoryOption.value,
        label: t(categoryOption.i18nKey),
      })),
    [t],
  );

  const handleSubmit = useCallback(() => {
    const comment = commentText.trim()
      ? `${category}: ${commentText.trim()}`
      : category;
    onSubmit(comment);
  }, [category, commentText, onSubmit]);

  const mainButtons = useMemo(
    () => [
      {
        label: t(ButtonsI18nKeys.Send),
        variant: ButtonVariant.Primary,
        disabled: !category,
        onClick: handleSubmit,
      },
    ],
    [category, handleSubmit, t],
  );

  return (
    <Popup
      open
      header={t(RateI18nKeys.NegativeFeedbackTitle)}
      onClose={onClose}
      size={PopupSize.Sm}
      className="!h-[422px]"
      mainButtons={mainButtons}
    >
      <div className="flex h-full flex-col gap-4 px-6 py-4">
        <Select
          labelProps={{
            label: t(RateI18nKeys.FeedbackTypeLabel),
            required: true,
          }}
          options={options}
          value={category}
          placeholder={t(ButtonsI18nKeys.Select)}
          onChange={(next) => setCategory(next as string)}
        />
        {isDislikeCommentEnabled && (
          <Textarea
            value={commentText}
            placeholder={t(RateI18nKeys.FeedbackCommentPlaceholder)}
            onChange={(value) => setCommentText(value ?? '')}
            containerClassName="flex-1"
            className="h-full"
          />
        )}
      </div>
    </Popup>
  );
};

export default memo(NegativeFeedbackModal);
