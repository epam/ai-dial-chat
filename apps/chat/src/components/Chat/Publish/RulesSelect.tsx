import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useState } from 'react';

import classNames from 'classnames';

import { PublicationFunctions } from '@/src/types/publication';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

interface FilterTypeProps {
  id: string;
  filters: string[];
  selectedFilter: string;
  capitalizeFirstLetters?: boolean;
  onChangeFilter: (filterType: PublicationFunctions) => void;
  menuClassName?: string;
  triggerClassName?: string;
}

export function RulesSelect({
  id,
  filters,
  selectedFilter,
  capitalizeFirstLetters,
  onChangeFilter,
  menuClassName,
  triggerClassName,
}: FilterTypeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onChangeFilter(e.currentTarget.value as PublicationFunctions);
    setIsOpen(false);
  };

  return (
    <Menu
      className={classNames('w-full grow', menuClassName)}
      onOpenChange={setIsOpen}
      listClassName="rounded-none w-full"
      trigger={
        <div
          data-qa={`filter-selector-${id}`}
          className={classNames(
            'flex w-full justify-between gap-2 bg-layer-3 px-2 py-[6.5px] text-xs',
            triggerClassName,
          )}
        >
          {capitalizeFirstLetters
            ? startCase(toLower(selectedFilter))
            : selectedFilter}
          <IconChevronDown
            data-qa={`open-filter-dropdown-${id}`}
            className={classNames(
              'shrink-0 text-primary transition-all',
              isOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      <div className="w-full bg-layer-3">
        {filters.map((filterType) => (
          <MenuItem
            key={filterType}
            className="max-w-full text-xs hover:bg-accent-primary-alpha"
            item={
              capitalizeFirstLetters
                ? startCase(toLower(filterType))
                : filterType
            }
            value={filterType}
            onClick={onChangeHandler}
          />
        ))}
      </div>
    </Menu>
  );
}
