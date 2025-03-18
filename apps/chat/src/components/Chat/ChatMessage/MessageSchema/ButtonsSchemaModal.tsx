import classNames from 'classnames';

import { ModalState } from '@/src/types/modal';

import { Modal } from '@/src/components/Common/Modal';

import { SchemaButton } from './SchemaButton';

import { FormSchemaButtonOption, MessageFormValue } from '@epam/ai-dial-shared';

interface Props {
  options: FormSchemaButtonOption[];
  showSelected: boolean;
  disabled: boolean;
  formValue?: MessageFormValue;
  buttonClassName?: string;
  containerClassName?: string;
  onButtonClick: (option: FormSchemaButtonOption) => void;
  onClose: () => void;
}

export const ButtonsSchemaModal: React.FC<Props> = ({
  options,
  showSelected,
  disabled,
  formValue,
  buttonClassName,
  containerClassName,
  onButtonClick,
  onClose,
}) => {
  return (
    <Modal
      portalId="theme-main"
      dataQa="hidden-schema-buttons"
      heading="Chat starters"
      state={ModalState.OPENED}
      containerClassName="h-fit flex flex-col py-4 max-h-full inline-block w-full max-w-[768px]"
      headingClassName="px-3"
      onClose={onClose}
    >
      <div
        className={classNames(
          'flex-1 !overflow-auto !px-3',
          containerClassName,
        )}
      >
        {options.map((option) => (
          <SchemaButton
            key={option.title}
            option={option}
            showSelected={!!showSelected}
            disabled={!!disabled}
            formValue={formValue}
            className={buttonClassName}
            onClick={onButtonClick}
          />
        ))}
      </div>
    </Modal>
  );
};
