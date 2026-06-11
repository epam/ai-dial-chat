import {
  DialFormItem,
  DialFormPopup,
  DialPrimaryButton,
  DialSelect,
  DialTextarea,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FEEDBACK_CATEGORIES } from '../../constants/feedback-categories';
import { ChatI18nKeys } from '../../constants/translation-keys';

interface Props {
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

const NegativeFeedbackModal: FC<Props> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [commentText, setCommentText] = useState('');

  const options = useMemo(
    () => FEEDBACK_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
    [],
  );

  const handleSubmit = useCallback(() => {
    const comment = commentText.trim()
      ? `${category}: ${commentText.trim()}`
      : category;
    onSubmit(comment);
  }, [category, commentText, onSubmit]);

  const footer = useMemo(
    () => (
      <div className="flex items-center justify-end gap-2 px-6 pb-6">
        <DialPrimaryButton
          label={t(ChatI18nKeys.Send)}
          disabled={!category}
          onClick={handleSubmit}
        />
      </div>
    ),
    [category, handleSubmit, t],
  );

  return (
    <DialFormPopup
      open
      header={t(ChatI18nKeys.NegativeFeedbackTitle)}
      onSubmit={handleSubmit}
      onClose={onClose}
      dividers={false}
      closeOnOutsideClick={true}
      size={PopupSize.Sm}
      className="!h-[422px]"
      footer={footer}
    >
      <div className="flex h-full flex-col gap-4 px-6 py-4">
        <DialFormItem label={t(ChatI18nKeys.FeedbackTypeLabel)} required>
          <DialSelect
            options={options}
            value={category}
            placeholder={t(ChatI18nKeys.FeedbackTypePlaceholder)}
            onChange={(next) => setCategory(next as string)}
          />
        </DialFormItem>
        <DialTextarea
          value={commentText}
          placeholder={t(ChatI18nKeys.FeedbackCommentPlaceholder)}
          onChange={(value) => setCommentText(value ?? '')}
          containerClassName="flex-1"
          className="h-full"
        />
      </div>
    </DialFormPopup>
  );
};

export default memo(NegativeFeedbackModal);
