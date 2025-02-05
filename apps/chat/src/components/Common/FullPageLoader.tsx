import { ModalState } from '@/src/types/modal';

import { Modal, Props as ModalProps } from './Modal';
import { Spinner } from './Spinner';

interface Props {
  onClose: ModalProps['onClose'];
  isOpen: boolean;
  hideClose?: ModalProps['hideClose'];
  dataQa?: ModalProps['dataQa'];
  portalId?: ModalProps['portalId'];
  onStop: () => void;
  loaderLabel: string;
  stopLabel: string;
  spinnerSize?: number;
}
export const FullPageLoader = ({
  onClose,
  isOpen,
  hideClose = true,
  dataQa = 'import-export-loader',
  portalId = 'theme-main',
  onStop,
  loaderLabel,
  stopLabel,
  spinnerSize = 50,
}: Props) => {
  return (
    <Modal
      onClose={onClose}
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      hideClose={hideClose}
      dataQa={dataQa}
      portalId={portalId}
      containerClassName="bg-transparent"
    >
      <div className="flex w-64 flex-col items-center gap-4 rounded bg-layer-3 p-6">
        <Spinner size={spinnerSize} />

        <h4 className="text-xl font-normal leading-6">{loaderLabel}</h4>
        <button
          className="text-sm font-medium text-accent-primary focus-visible:outline-none"
          onClick={onStop}
          data-qa="stop-loading"
        >
          {stopLabel}
        </button>
      </div>
    </Modal>
  );
};
