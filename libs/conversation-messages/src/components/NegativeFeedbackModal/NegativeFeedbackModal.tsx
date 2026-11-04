import {
  ButtonVariant,
  Popup,
  PopupSize,
  Select,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import type { NegativeFeedbackModalProps } from '../../models/negative-feedback-modal';
import { NegativeFeedbackCategory } from '../../types/negative-feedback-category';

/** Popup shown before a dislike is sent, collecting a required category and an optional comment. */
export const NegativeFeedbackModal: FC<NegativeFeedbackModalProps> = memo(
  ({ onClose, onSubmit, isCommentEnabled = true, labels }) => {
    const {
      title = 'Send negative feedback',
      feedbackTypeLabel = 'What type of feedback you want to give?',
      selectPlaceholder = 'Select',
      commentPlaceholder = 'Type an optional comment to your feedback',
      sendLabel = 'Send',
      categoryLabels,
    } = labels ?? {};
    const [category, setCategory] = useState('');
    const [commentText, setCommentText] = useState('');

    const options = useMemo(
      () =>
        Object.values(NegativeFeedbackCategory).map((value) => ({
          value,
          label: categoryLabels?.[value] ?? value,
        })),
      [categoryLabels],
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
          label: sendLabel,
          variant: ButtonVariant.Primary,
          disabled: !category,
          onClick: handleSubmit,
        },
      ],
      [category, handleSubmit, sendLabel],
    );

    return (
      <Popup
        open
        header={title}
        onClose={onClose}
        size={PopupSize.Sm}
        className="h-[422px]!"
        mainButtons={mainButtons}
      >
        <div className="flex h-full flex-col gap-4 px-6 py-4">
          <Select
            labelProps={{ label: feedbackTypeLabel, required: true }}
            options={options}
            value={category}
            placeholder={selectPlaceholder}
            onChange={(next) => setCategory(next as string)}
          />
          {isCommentEnabled && (
            <Textarea
              value={commentText}
              placeholder={commentPlaceholder}
              onChange={(value) => setCommentText(value ?? '')}
              containerClassName="flex-1"
              className="h-full"
            />
          )}
        </div>
      </Popup>
    );
  },
);
