import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FiltersTypes, TargetAudienceFilter } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { MultipleComboBox } from '../../Common/MultipleComboBox';
import { RegexParamInput } from './RegexParamInput';
import { FilterTypeSelect } from './TargetAudienceFilterTypeSelect';

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

export function PublishModalTargetAudienceFilter({
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
    initialSelectedFilter?.filterType === FiltersTypes.Regex
      ? initialSelectedFilter.filterParams[0]
      : '',
  );

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
      className="flex flex-col md:flex-row"
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
          placeholder={t(`Enter ${name.toLowerCase()}`) as string}
          notFoundPlaceholder={t(`Enter ${name.toLowerCase()}`) as string}
        />
      )}
    </div>
  );
}
