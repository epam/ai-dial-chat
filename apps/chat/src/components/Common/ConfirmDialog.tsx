import { useId, useRef } from 'react';

import { ModalState } from '@/src/types/modal';

import Modal from '@/src/components/Common/Modal';

interface Props {
  isOpen: boolean;
  heading: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  onClose: (result: boolean) => void;
}

export const ConfirmDialog = ({
  heading,
  description,
  confirmLabel,
  cancelLabel,
  isOpen,
  onClose,
}: Props) => {
  const confirmLabelRef = useRef<HTMLButtonElement>(null);

  const headingId = useId();
  const descriptionId = useId();

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="confirmation-dialog"
      containerClassName="z-50 flex min-w-[90%] flex-col items-center gap-4 p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
      hideClose
    >
      <div className="flex w-full flex-col gap-2 text-start">
        <h2 id={headingId} className="whitespace-pre text-base font-semibold">
          {heading}
        </h2>
        <div>
          {description && (
            <p
              id={descriptionId}
              data-qa="confirm-message"
              className="whitespace-pre-wrap text-secondary"
            >
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-3">
        {cancelLabel && (
          <button
            className="button button-secondary"
            onClick={() => {
              onClose(false);
            }}
            data-qa="cancel-dialog"
          >
            {cancelLabel}
          </button>
        )}
        <button
          ref={confirmLabelRef}
          autoFocus
          className="button button-primary"
          onClick={() => onClose(true)}
          data-qa="confirm"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
