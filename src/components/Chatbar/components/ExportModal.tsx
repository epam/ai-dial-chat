import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import Modal from '../../Common/Modal';

interface Props {
  onExport: (args?: { withAttachments?: boolean }) => void;
  onClose: () => void;
  isOpen: boolean;
}
export const ExportModal = ({ onExport, onClose, isOpen }: Props) => {
  const { t } = useTranslation(Translation.SideBar);
  return (
    <Modal
      dataQa="single-export-modal"
      onClose={onClose}
      isOpen={isOpen}
      portalId="theme-main"
      containerClassName="inline-block w-full w-[336px] px-3 py-4"
    >
      <h4 className="mb-3 text-base font-semibold">{t('Export')}</h4>
      <div className="flex flex-col items-start gap-3">
        <button
          data-qa="with-attachments"
          className="px-3"
          onClick={() => {
            onExport({ withAttachments: true });
          }}
        >
          {t('With attachments')}
        </button>
        <button
          data-qa="without-attachments"
          className="px-3"
          onClick={() => {
            onExport();
          }}
        >
          {t('Without attachments')}
        </button>
      </div>
    </Modal>
  );
};
