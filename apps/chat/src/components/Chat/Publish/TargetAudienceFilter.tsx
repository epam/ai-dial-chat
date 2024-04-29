import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  PublicationFunctions,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { MultipleComboBox } from '../../Common/MultipleComboBox';
import { FilterFunctionSelect } from './FilterFunctionSelect';
import { RegexParamInput } from './RegexParamInput';

interface Props {
  id: string;
  name: string;
  initialSelectedFilter?: TargetAudienceFilter;
  onChangeFilter: (filter: TargetAudienceFilter) => void;
}

const getItemLabel = (item: string) => item;

const filterFunctionValues = [
  PublicationFunctions.CONTAIN,
  PublicationFunctions.EQUAL,
  PublicationFunctions.REGEX,
  PublicationFunctions.TRUE,
  PublicationFunctions.FALSE,
];

export function TargetAudienceFilterComponent({
  id,
  name,
  initialSelectedFilter,
  onChangeFilter,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterFunction, setFilterFunction] = useState<PublicationFunctions>(
    initialSelectedFilter?.filterFunction ?? filterFunctionValues[0],
  );
  const [filterParams, setFilterParams] = useState<string[]>([]);
  const [filterRegexParam, setFilterRegexParam] = useState<string>(
    (initialSelectedFilter?.filterFunction === PublicationFunctions.REGEX &&
      initialSelectedFilter.filterParams[0]) ||
      '',
  );

  const onChangeFilterFunction = useCallback(
    (filterFunction: PublicationFunctions) => {
      setFilterFunction(filterFunction);
      if (filterFunction === PublicationFunctions.REGEX) {
        onChangeFilter({
          id,
          name,
          filterFunction,
          filterParams: [filterRegexParam],
        });
        return;
      }
      onChangeFilter({ id, name, filterFunction, filterParams });
    },
    [filterParams, id, name, onChangeFilter, filterRegexParam],
  );
  const onChangeFilterParams = useCallback(
    (filterParams: string[]) => {
      setFilterParams(filterParams);
      onChangeFilter({ id, name, filterFunction, filterParams });
    },
    [filterFunction, id, name, onChangeFilter],
  );

  const onChangeFilterRegexParam = useCallback(
    (filterRegexParam: string) => {
      setFilterRegexParam(filterRegexParam);
      onChangeFilter({
        id,
        name,
        filterFunction: PublicationFunctions.REGEX,
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
      <FilterFunctionSelect
        filterFunctions={filterFunctionValues}
        selectedFilterFunction={filterFunction}
        onChangeFilterFunction={onChangeFilterFunction}
        id={id}
      />
      {filterFunction === PublicationFunctions.REGEX ? (
        <RegexParamInput
          regEx={filterRegexParam}
          onRegExChange={onChangeFilterRegexParam}
        />
      ) : (
        <MultipleComboBox
          initialSelectedItems={initialSelectedFilter?.filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={onChangeFilterParams}
          placeholder={t('Enter one or more options...') as string}
        />
      )}
    </div>
  );
}
