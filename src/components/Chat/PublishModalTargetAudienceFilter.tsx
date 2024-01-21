import { IconChevronDown } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FiltersTypes, TargetAudienceFilter } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { Menu, MenuItem } from '../Common/DropdownMenu';
import { MultipleComboBox } from '../Common/MultipleComboBox';

const filterValues = [
  FiltersTypes.Contains,
  FiltersTypes.NotContains,
  FiltersTypes.Equals,
  FiltersTypes.Regex,
];

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
      className="h-[38px] w-full max-w-[125px] grow rounded border border-primary text-xs focus-within:border-accent-primary focus:border-accent-primary"
    >
      <Menu
        className="w-full px-3"
        onOpenChange={setIsOpen}
        trigger={
          <div className="flex items-center justify-between gap-2">
            {selectedType}
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
        {filterTypes.map((filterType) => (
          <MenuItem
            key={filterType}
            className="max-w-[350px] text-xs hover:bg-accent-primary-alpha"
            item={t(filterType)}
            value={filterType}
            onClick={onChangeHandler}
          />
        ))}
      </Menu>
    </div>
  );
}

interface Props {
  id: string;
  name: string;
  onChangeFilter: (filter: TargetAudienceFilter) => void;
}

const getItemLabel = (item: string) => item;

export function PublishModalTargetAudienceFilter({
  id,
  name,
  onChangeFilter,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterType, setFilterType] = useState<FiltersTypes>(filterValues[0]);
  const [filterParams, setFilteParams] = useState<string[]>([]);

  const onChangeFilterType = useCallback(
    (filterType: FiltersTypes) => {
      setFilterType(filterType);
      onChangeFilter({ id, name, filterType, filterParams });
    },
    [filterParams, id, name, onChangeFilter],
  );
  const onChangeFilterParams = useCallback(
    (filterParams: string[]) => {
      setFilteParams(filterParams);
      onChangeFilter({ id, name, filterType, filterParams });
    },
    [filterType, id, name, onChangeFilter],
  );

  return (
    <div
      className="flex flex-col md:flex-row"
      data-qa={`publish-audience-filter-${id}`}
    >
      <FilterTypeSelect
        filterTypes={filterValues}
        selectedType={filterType}
        onChangeFilterType={onChangeFilterType}
        id={id}
      />
      <MultipleComboBox
        getItemLabel={getItemLabel}
        getItemValue={getItemLabel}
        onChangeSelectedItems={onChangeFilterParams}
        placeholder={t(`Enter ${name.toLowerCase()}`) as string}
        notFoundPlaceholder={t(`Enter ${name.toLowerCase()}`) as string}
      />
    </div>
  );
}
