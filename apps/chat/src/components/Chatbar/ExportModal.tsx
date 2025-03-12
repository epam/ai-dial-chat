import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { OUTSIDE_PRESS } from '@/src/constants/modal';

import { Modal } from '../Common/Modal';

interface Props {
  onExport: (args?: { withAttachments?: boolean }) => void;
  onClose: () => void;
}
export const ExportModal = ({ onExport, onClose }: Props) => {
  const { t } = useTranslation(Translation.SideBar);

  return (
    <Modal
      dataQa="single-export-modal"
      onClose={onClose}
      state={ModalState.OPENED}
      portalId="theme-main"
      containerClassName="inline-block max-w-[350px] w-full px-3 py-4 rounded"
      dismissProps={OUTSIDE_PRESS}
    >
      <h4 className="mb-3 text-base font-semibold">{t('Export')}</h4>
      <div className="flex flex-col items-start">
        <button
          data-qa="with-attachments"
          className="h-[34px] w-full rounded px-3 text-left hover:bg-accent-secondary-alpha"
          onClick={() => {
            onExport({ withAttachments: true });
          }}
        >
          {t('With attachments')}
        </button>
        <button
          data-qa="without-attachments"
          className="h-[34px] w-full rounded px-3 text-left hover:bg-accent-secondary-alpha"
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
