import { useTranslation } from 'next-i18next';

import { Conversation, Message } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '@/src/components/Common/Modal';

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  message: Message;
  conversation: Conversation;
}

export const ChatMessageTemplatesModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="message-templates-dialog"
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown', outsidePress: true }}
      hideClose
      heading={t('Message templates')}
    >
      <div className="flex flex-col justify-between gap-4">
        <div className="flex w-full flex-col gap-2 text-start">
          <div>
            <p
              data-qa="confirm-message"
              className="whitespace-pre-wrap text-secondary"
            >
              Please,
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-3">
          <button
            className="button button-secondary"
            onClick={() => {
              onClose(false);
            }}
            data-qa="cancel-button"
          >
            Cancel
          </button>
          <button
            autoFocus
            className="button button-primary"
            onClick={() => onClose(true)}
            data-qa="save-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};
