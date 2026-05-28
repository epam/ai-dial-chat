import { useTranslation } from '@/src/hooks/useTranslation';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { SideBarI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

import { DialGhostButton } from '@epam/ai-dial-ui-kit';

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
      <h4 className="mb-3 text-base font-semibold">
        {t(SideBarI18nKeys.Export)}
      </h4>
      <div className="flex flex-col items-start">
        <DialGhostButton
          data-qa="with-attachments"
          className="w-full justify-start text-primary hover:bg-accent-secondary-alpha"
          onClick={() => {
            onExport({ withAttachments: true });
          }}
          label={t(SideBarI18nKeys.WithAttachments)}
        />
        <DialGhostButton
          data-qa="without-attachments"
          className="w-full justify-start text-primary hover:bg-accent-secondary-alpha"
          onClick={() => {
            onExport();
          }}
          label={t(SideBarI18nKeys.WithoutAttachments)}
        />
      </div>
    </Modal>
  );
};
