import { useId, useRef } from 'react';

import classNames from 'classnames';

import { ModalState } from '@/src/types/modal';

import Modal from '@/src/components/Common/Modal';

interface Props {
  isOpen: boolean;
  heading: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  textClasses?: string;
  buttonsClasses?: string;
  descriptionClasses?: string;
  onClose: (result: boolean) => void;
}

export const ConfirmDialog = ({
  heading,
  description,
  confirmLabel,
  cancelLabel,
  isOpen,
  textClasses,
  buttonsClasses,
  descriptionClasses,
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
      <div className={classNames('flex flex-col gap-2', textClasses)}>
        <h2 id={headingId} className="text-base font-semibold">
          {heading}
        </h2>
        {description && (
          <p
            id={descriptionId}
            data-qa="confirm-message"
            className={descriptionClasses}
          >
            {description}
          </p>
        )}
      </div>
      <div className={classNames('flex items-center gap-3', buttonsClasses)}>
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
