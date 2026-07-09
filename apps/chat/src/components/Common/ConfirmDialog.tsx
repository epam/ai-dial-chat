import { MouseEvent, ReactNode, useCallback, useId, useRef } from 'react';

import { ModalState } from '@/src/types/modal';

import { DISALLOW_INTERACTIONS } from '@/src/constants/modal';

import { Modal } from '@/src/components/Common/Modal';

import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  heading: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string | null;
  headingClassName?: string;
  showHeadingTooltip?: boolean;
  overlayClassName?: string;
  onClose: (isConfirmed: boolean) => void;
}

export const ConfirmDialog = ({
  heading,
  headingClassName,
  description,
  confirmLabel,
  cancelLabel,
  isOpen,
  onClose,
  showHeadingTooltip,
  overlayClassName,
}: Props) => {
  const confirmLabelRef = useRef<HTMLButtonElement>(null);

  const descriptionId = useId();

  const handleConfirm = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClose(true);
    },
    [onClose],
  );

  const handleCancel = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onClose(false);
    },
    [onClose],
  );

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="confirmation-dialog"
      overlayClassName={overlayClassName}
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={DISALLOW_INTERACTIONS}
      hideClose
      heading={heading}
      headingClassName={headingClassName}
      showHeadingTooltip={showHeadingTooltip}
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
            <DialNeutralButton
              data-no-context-menu
              label={cancelLabel}
              onClick={handleCancel}
              data-qa="cancel-dialog"
            />
          )}
          <DialPrimaryButton
            data-no-context-menu
            ref={confirmLabelRef}
            autoFocus
            label={confirmLabel}
            onClick={handleConfirm}
            data-qa="confirm"
          />
        </div>
      </div>
    </Modal>
  );
};
