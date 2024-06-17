import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { PublicationFunctions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface FilterTypeProps {
  id: string;
  filterFunctions: string[];
  selectedFilterFunction: string;
  onChangeFilterFunction: (filterType: PublicationFunctions) => void;
  readonly?: boolean;
}

export function FilterFunctionSelect({
  id,
  filterFunctions,
  selectedFilterFunction,
  onChangeFilterFunction,
  readonly,
}: FilterTypeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { t } = useTranslation(Translation.SideBar);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onChangeFilterFunction(e.currentTarget.value as PublicationFunctions);
    setIsOpen(false);
  };

  return (
    <div
      data-qa={`filter-selector-${id}`}
      className="h-[38px] w-full max-w-[140px] grow rounded border border-primary focus-within:border-accent-primary focus:border-accent-primary"
    >
      {!readonly ? (
        <Menu
          className="flex w-full items-center px-3"
          onOpenChange={setIsOpen}
          trigger={
            <div className="flex w-full items-center justify-between gap-2">
              {selectedFilterFunction}
              <IconChevronDown
                data-qa={`open-filter-dropdown-${id}`}
                className={classNames(
                  'shrink-0 text-primary-bg-light transition-all',
                  isOpen && 'rotate-180',
                )}
                width={18}
                height={18}
              />
            </div>
          }
        >
          <div className="bg-layer-3">
            {filterFunctions.map((filterType) => (
              <MenuItem
                key={filterType}
                className="max-w-[350px] hover:bg-accent-primary-alpha"
                item={t(filterType)}
                value={filterType}
                onClick={onChangeHandler}
              />
            ))}
          </div>
        </Menu>
      ) : (
        <button
          className="flex h-[34px] max-w-[350px] items-center px-3"
          disabled
        >
          {selectedFilterFunction}
        </button>
      )}
    </div>
  );
}
