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
  onChangeFilter?: (filter: TargetAudienceFilter) => void;
  readonly?: boolean;
}

const getItemLabel = (item: string) => item;

const filterFunctionValues = [
  PublicationFunctions.Contain,
  PublicationFunctions.Equal,
  PublicationFunctions.Regex,
];

export function TargetAudienceFilterComponent({
  id,
  name,
  initialSelectedFilter,
  onChangeFilter,
  readonly = false,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterFunction, setFilterFunction] = useState<PublicationFunctions>(
    initialSelectedFilter?.filterFunction ?? filterFunctionValues[0],
  );
  const [filterParams, setFilterParams] = useState<string[]>([]);
  const [filterRegexParam, setFilterRegexParam] = useState<string>(
    (initialSelectedFilter?.filterFunction === PublicationFunctions.Regex &&
      initialSelectedFilter.filterParams[0]) ||
      '',
  );

  const handleChangeFilterFunction = useCallback(
    (filterFunction: PublicationFunctions) => {
      if (!onChangeFilter) return;

      setFilterFunction(filterFunction);
      if (filterFunction === PublicationFunctions.Regex) {
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
  const handleChangeFilterParams = useCallback(
    (filterParams: string[]) => {
      if (!onChangeFilter) return;

      setFilterParams(filterParams);
      onChangeFilter({ id, name, filterFunction, filterParams });
    },
    [filterFunction, id, name, onChangeFilter],
  );

  const handleChangeFilterRegexParam = useCallback(
    (filterRegexParam: string) => {
      if (!onChangeFilter) return;

      setFilterRegexParam(filterRegexParam);
      onChangeFilter({
        id,
        name,
        filterFunction: PublicationFunctions.Regex,
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
        readonly={readonly}
        filterFunctions={filterFunctionValues}
        selectedFilterFunction={filterFunction}
        onChangeFilterFunction={handleChangeFilterFunction}
        id={id}
      />
      {filterFunction === PublicationFunctions.Regex ? (
        <RegexParamInput
          readonly={readonly}
          regEx={filterRegexParam}
          onRegExChange={handleChangeFilterRegexParam}
        />
      ) : (
        <MultipleComboBox
          readonly={readonly}
          initialSelectedItems={initialSelectedFilter?.filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={handleChangeFilterParams}
          placeholder={t('Enter one or more options...') as string}
        />
      )}
    </div>
  );
}
