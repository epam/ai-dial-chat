import { useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

import { DialPrimaryButton, DialTextarea } from '@epam/ai-dial-ui-kit';

export const DislikeCommentModal = ({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) => {
  const { t } = useTranslation(Translation.Chat);

  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit(comment);
  };

  return (
    <Modal
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
      heading={t(ChatI18nKeys.SendFeedback)}
      state={ModalState.OPENED}
      onClose={onClose}
      dataQa="dislike-comment-modal"
      containerClassName="flex flex-col w-[500px] h-[334px] max-w-full max-h-full md:px-6 px-3 p-4 md:p-6 mb-3"
      portalId="chat"
    >
      <DialTextarea
        id="dislike-comment"
        data-qa="dislike-comment-input"
        className="size-full"
        containerClassName="flex-1 mt-3"
        placeholder={t(ChatI18nKeys.OptionalFeedbackComment)}
        value={comment}
        onChange={(value) => setComment(value ?? '')}
      />

      <DialPrimaryButton
        className="mt-4 self-end"
        label={t(ChatI18nKeys.Send)}
        onClick={handleSubmit}
        data-qa="dislike-send-button"
      />
    </Modal>
  );
};
