import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FiltersTypes, TargetAudienceFilter } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { MultipleComboBox } from '../../Common/MultipleComboBox';
import { FilterTypeSelect } from './FilterTypeSelect';
import { RegexParamInput } from './RegexParamInput';

interface Props {
  id: string;
  name: string;
  initialSelectedFilter?: TargetAudienceFilter;
  onChangeFilter: (filter: TargetAudienceFilter) => void;
}

const filterTypeValues = [
  FiltersTypes.Contains,
  FiltersTypes.NotContains,
  FiltersTypes.Equals,
  FiltersTypes.Regex,
];

const getItemLabel = (item: string) => item;

export function TargetAudienceFilterComponent({
  id,
  name,
  initialSelectedFilter,
  onChangeFilter,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterType, setFilterType] = useState<FiltersTypes>(
    initialSelectedFilter?.filterType ?? filterTypeValues[0],
  );
  const [filterParams, setFilteParams] = useState<string[]>([]);
  const [filterRegexParam, setfilterRegexParam] = useState<string>(
    (initialSelectedFilter?.filterType === FiltersTypes.Regex &&
      initialSelectedFilter.filterParams[0]) ||
      '',
  );

  const onChangeFilterType = useCallback(
    (filterType: FiltersTypes) => {
      setFilterType(filterType);
      if (filterType === FiltersTypes.Regex) {
        onChangeFilter({
          id,
          name,
          filterType,
          filterParams: [filterRegexParam],
        });
        return;
      }
      onChangeFilter({ id, name, filterType, filterParams });
    },
    [filterParams, id, name, onChangeFilter, filterRegexParam],
  );
  const onChangeFilterParams = useCallback(
    (filterParams: string[]) => {
      setFilteParams(filterParams);
      onChangeFilter({ id, name, filterType, filterParams });
    },
    [filterType, id, name, onChangeFilter],
  );

  const onChangefilterRegexParam = useCallback(
    (filterRegexParam: string) => {
      setfilterRegexParam(filterRegexParam);
      onChangeFilter({
        id,
        name,
        filterType: FiltersTypes.Regex,
        filterParams: [filterRegexParam],
      });
    },
    [id, name, onChangeFilter],
  );

  return (
    <div
      className="flex flex-col gap-1 sm:flex-row"
      data-qa={`publish-audience-filter-${id}`}
    >
      <FilterTypeSelect
        filterTypes={filterTypeValues}
        selectedType={filterType}
        onChangeFilterType={onChangeFilterType}
        id={id}
      />
      {filterType === FiltersTypes.Regex ? (
        <RegexParamInput
          regEx={filterRegexParam}
          onRegExChange={onChangefilterRegexParam}
        />
      ) : (
        <MultipleComboBox
          initialSelectedItems={initialSelectedFilter?.filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={onChangeFilterParams}
          placeholder={t('Enter one or more options...') as string}
          notFoundPlaceholder={t('Enter regular expression...') as string}
        />
      )}
    </div>
  );
}
