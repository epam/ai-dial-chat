import { useId } from '@floating-ui/react';
import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '@/src/components/Common/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  modalDataQa: string;
  title: string;
  children: ReactNode;
}

export const SelectFolder = ({
  isOpen,
  modalDataQa,
  onClose,
  title,
  children,
}: Props) => {
  const headingId = useId();
  const { t } = useTranslation(Translation.Chat);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      dataQa={modalDataQa}
      containerClassName="flex min-w-full flex-col gap-4 md:min-w-[425px] sm:w-[525px] w-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex flex-col gap-2 overflow-auto">
        <div className="flex justify-between px-6 pt-4">
          <h2 id={headingId} className="text-base font-semibold">
            {t(title)}
          </h2>
        </div>
        {children}
      </div>
    </Modal>
  );
};
