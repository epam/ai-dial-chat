import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useState } from 'react';

import classNames from 'classnames';

import { Menu, MenuItem } from './DropdownMenu';

export interface SelectOption {
  id: string;
  displayName: string;
}
interface SelectProps {
  options: SelectOption[];
  selectedOptionName: string;
  onOptionChangeHandler: (option: string) => void;
  containerClassName?: string;
  selectClassName?: string;
  triggerClassName?: string;
  optionClassName?: string;
}

export const Select = ({
  options,
  selectedOptionName,
  onOptionChangeHandler,
  containerClassName,
  selectClassName,
  triggerClassName,
  optionClassName,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onOptionChangeHandler(e.currentTarget.value);
    setIsOpen(false);
  };

  if (options.length < 1) {
    return null;
  }
  return (
    <div className={classNames('h-[38px] rounded pr-1', containerClassName)}>
      <Menu
        className={classNames('w-full px-3', selectClassName)}
        onOpenChange={setIsOpen}
        trigger={
          <div
            className={classNames(
              'flex items-center justify-between gap-2 rounded capitalize',
              triggerClassName,
            )}
          >
            {selectedOptionName}
            <IconChevronDown
              className={classNames(
                'shrink-0 text-primary-bg-dark transition-all',
                isOpen && 'rotate-180',
              )}
              width={18}
              height={18}
            />
          </div>
        }
      >
        {options.map((option) => (
          <MenuItem
            key={option.id}
            className={classNames(
              'max-w-[350px] hover:bg-accent-primary-alpha',
              optionClassName,
            )}
            item={option.displayName}
            value={option.id}
            onClick={onChangeHandler}
          />
        ))}
      </Menu>
    </div>
  );
};
