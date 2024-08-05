import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '../Common/Modal';

interface Props {
  onExport: (args?: { withAttachments?: boolean }) => void;
  onClose: () => void;
  isOpen: boolean;
}
export const ExportModal = ({ onExport, onClose, isOpen }: Props) => {
  const { t } = useTranslation(Translation.ChatBar);
  return (
    <Modal
      dataQa="single-export-modal"
      onClose={onClose}
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      portalId="theme-main"
      containerClassName="inline-block max-w-[350px] w-full px-3 py-4 rounded"
    >
      <h4 className="mb-3 text-base font-semibold">
        {t('chatbar.header.export')}
      </h4>
      <div className="flex flex-col items-start">
        <button
          data-qa="with-attachments"
          className="h-[34px] w-full rounded px-3 text-left hover:bg-accent-secondary-alpha"
          onClick={() => {
            onExport({ withAttachments: true });
          }}
        >
          {t('chatbar.button.with_attachments')}
        </button>
        <button
          data-qa="without-attachments"
          className="h-[34px] w-full rounded px-3 text-left hover:bg-accent-secondary-alpha"
          onClick={() => {
            onExport();
          }}
        >
          {t('chatbar.button.without_attachments')}
        </button>
      </div>
    </Modal>
  );
};
