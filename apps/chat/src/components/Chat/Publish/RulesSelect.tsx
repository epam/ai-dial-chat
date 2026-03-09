import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useMemo, useState } from 'react';

import classNames from 'classnames';

import { PublicationFunctions } from '@/src/types/publication';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

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

export const filterLabelMap: Record<string, string> = {
  [PublicationFunctions.Contain]: 'Contains',
  [PublicationFunctions.Equal]: 'Equals',
};

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

  const getFilterLabel = (filterType: string) => {
    const filterLabel = filterLabelMap[filterType] || filterType;
    return capitalizeFirstLetters
      ? startCase(toLower(filterLabel))
      : filterLabel;
  };

  const selectedFilterLabel = useMemo(() => {
    return getFilterLabel(selectedFilter);
  }, [selectedFilter, capitalizeFirstLetters]);

  const onChangeHandler = (e: MouseEvent<HTMLButtonElement>) => {
    onChangeFilter(e.currentTarget.value as PublicationFunctions);
    setIsOpen(false);
  };

  return (
    <Menu
      className={classNames('w-full grow bg-layer-3', menuClassName)}
      onOpenChange={setIsOpen}
      listClassName="rounded-none w-full"
      trigger={
        <div
          data-qa={`filter-selector-${id}`}
          className={classNames(
            'flex w-full justify-between gap-2 px-2 py-[6.5px] text-xs',
            triggerClassName,
          )}
        >
          {selectedFilterLabel}
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
            item={getFilterLabel(filterType)}
            value={filterType}
            onClick={onChangeHandler}
          />
        ))}
      </div>
    </Menu>
  );
}
