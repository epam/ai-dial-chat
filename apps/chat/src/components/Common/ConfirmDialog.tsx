import { useId, useRef } from 'react';

import { ModalState } from '@/src/types/modal';

import { DISALLOW_INTERACTIONS } from '@/src/constants/modal';

import Modal from '@/src/components/Common/Modal';

interface Props {
  isOpen: boolean;
  heading: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string | null;
  headingClassName?: string;
  onClose: (result: boolean) => void;
}

export const ConfirmDialog = ({
  heading,
  headingClassName,
  description,
  confirmLabel,
  cancelLabel,
  isOpen,
  onClose,
}: Props) => {
  const confirmLabelRef = useRef<HTMLButtonElement>(null);

  const descriptionId = useId();

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="confirmation-dialog"
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={DISALLOW_INTERACTIONS}
      hideClose
      heading={heading}
      headingClassName={headingClassName}
    >
      <div className="flex flex-col justify-between gap-4">
        <div className="flex w-full flex-col gap-2 text-start">
          <div>
            {description && (
              <p
                id={descriptionId}
                data-qa="confirm-message"
                className="whitespace-pre-wrap break-words text-secondary"
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
      </div>
    </Modal>
  );
};
