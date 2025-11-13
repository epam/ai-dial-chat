import { useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

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
      heading="Send feedback"
      state={ModalState.OPENED}
      onClose={onClose}
      dataQa="dislike-comment-modal"
      containerClassName="flex flex-col w-[500px] h-[334px] max-w-full max-h-full md:px-6 px-3 p-4 md:p-6 mb-3"
      portalId="chat"
    >
      <textarea
        id="dislike-comment"
        data-qa="dislike-comment-input"
        placeholder="Type an optional comment to your feedback"
        className="input-form grow resize-none"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      ></textarea>
      <button
        className="button button-primary mt-4 self-end"
        onClick={handleSubmit}
        data-qa="dislike-send-button"
      >
        {t('Send')}
      </button>
    </Modal>
  );
};
