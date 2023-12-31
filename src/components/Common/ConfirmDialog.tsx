import { useId, useRef } from 'react';

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
      isOpen={isOpen}
      onClose={() => onClose(false)}
      dataQa="confirmation-dialog"
      containerClassName="z-50 flex min-w-[90%] flex-col items-center gap-4 p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
      hideClose
    >
      <div className="flex flex-col gap-2">
        <h2 id={headingId} className="text-base font-semibold">
          {heading}
        </h2>
        {description && (
          <p id={descriptionId} data-qa="confirm-message">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
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
