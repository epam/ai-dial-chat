import { useId } from 'react';

import classNames from 'classnames';

import { ModalState } from '@/src/types/modal';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import Modal from '@/src/components/Common/Modal';

const fakeCloseHandler = () => undefined;

interface Props {
  isOpen: boolean;
  heading: string;
  options: {
    label: string;
    dataQa: string;
    className?: string;
    onClick: () => void;
  }[];
  description?: string;
  headingClassName?: string;
  onClose?: () => void;
}

export const OptionsDialog = ({
  heading,
  headingClassName,
  description,
  isOpen,
  onClose,
  options,
}: Props) => {
  const descriptionId = useId();

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose ?? fakeCloseHandler}
      dataQa="options-dialog"
      containerClassName="inline-block w-full min-w-[90%] px-3 py-4 md:p-6 text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
      hideClose={!onClose}
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
          {options.map((option) => (
            <button
              key={option.label}
              className={classNames('button button-primary', option.className)}
              onClick={option.onClick}
              data-qa={option.dataQa}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
