import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FiltersTypes } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

interface FilterTypeProps {
  id: string;
  filterTypes: string[];
  selectedType: string;
  onChangeFilterType: (filterType: FiltersTypes) => void;
}

export function FilterTypeSelect({
  id,
  filterTypes,
  selectedType,
  onChangeFilterType,
}: FilterTypeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { t } = useTranslation(Translation.SideBar);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onChangeFilterType(e.currentTarget.value as FiltersTypes);
    setIsOpen(false);
  };

  return (
    <div
      data-qa={`filter-selector-${id}`}
      className="h-[38px] w-full max-w-[140px] grow rounded-primary border border-secondary bg-layer-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary"
    >
      <Menu
        className="w-full px-3"
        onOpenChange={setIsOpen}
        listClassName="rounded-primary shadow-primary border border-secondary bg-layer-2 text-primary-bg-light"
        trigger={
          <div className="flex items-center justify-between gap-2">
            {selectedType}
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
        <div>
          {filterTypes.map((filterType) => (
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
    </div>
  );
}
