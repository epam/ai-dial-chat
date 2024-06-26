import { IconCheck, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { translate } from '@/src/utils/app/translation';

import {
  PublicationFunctions,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { MultipleComboBox } from '../../Common/MultipleComboBox';
import { RegexParamInput } from './RegexParamInput';
import { RulesSelect } from './RulesSelect';

const emptySelector = translate('Select');

interface Props {
  initialSelectedFilter?: TargetAudienceFilter;
  onSaveFilter?: (filter: TargetAudienceFilter) => void;
  readonly?: boolean;
  onCloseFilter?: () => void;
}

const getItemLabel = (item: string) => item;

const filterFunctionValues = [
  PublicationFunctions.Contain,
  PublicationFunctions.Equal,
  PublicationFunctions.Regex,
];

export function NewTargetAudienceFilterComponent({
  initialSelectedFilter,
  onSaveFilter,
  readonly = false,
  onCloseFilter,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterFunction, setFilterFunction] = useState<
    PublicationFunctions | typeof emptySelector
  >(initialSelectedFilter?.filterFunction ?? emptySelector);
  const [filterParams, setFilterParams] = useState<string[]>([]);
  const [filterRegexParam, setFilterRegexParam] = useState<string>(
    (initialSelectedFilter?.filterFunction === PublicationFunctions.Regex &&
      initialSelectedFilter.filterParams[0]) ||
      '',
  );
  const [selectedTarget, setSelectedTarget] = useState(emptySelector);

  const publicationFilters = useAppSelector(
    SettingsSelectors.selectPublicationFilters,
  );

  const handleSaveFilter = useCallback(() => {
    if (
      !onSaveFilter ||
      selectedTarget === emptySelector ||
      filterFunction === emptySelector
    ) {
      return;
    }

    if (filterFunction === PublicationFunctions.Regex) {
      onSaveFilter({
        id: selectedTarget,
        name: selectedTarget,
        filterFunction,
        filterParams: [filterRegexParam],
      });

      return;
    }

    onSaveFilter({
      id: selectedTarget,
      name: selectedTarget,
      filterFunction: filterFunction as PublicationFunctions,
      filterParams,
    });
  }, [filterFunction, filterParams, filterRegexParam, onSaveFilter]);

  const handleChangeTarget = useCallback((target: string) => {
    setSelectedTarget(target);
  }, []);

  const handleChangeFilterFunction = useCallback(
    (filterFunction: PublicationFunctions) => {
      setFilterFunction(filterFunction);
    },
    [],
  );
  const handleChangeFilterParams = useCallback((filterParams: string[]) => {
    setFilterParams(filterParams);
  }, []);

  const handleChangeFilterRegexParam = useCallback(
    (filterRegexParam: string) => {
      setFilterRegexParam(filterRegexParam);
    },
    [],
  );

  return (
    <div
      className="flex flex-col gap-[1px] sm:flex-row"
      data-qa="publish-audience-filter-selectors"
    >
      <RulesSelect
        className="max-w-[145px] font-semibold"
        readonly={readonly}
        filters={publicationFilters}
        selectedFilter={selectedTarget}
        capitalizeFirstLetters
        onChangeFilter={handleChangeTarget}
        id="targets"
      />
      <RulesSelect
        className="max-w-[100px] italic"
        readonly={readonly}
        filters={filterFunctionValues}
        selectedFilter={filterFunction}
        onChangeFilter={handleChangeFilterFunction}
        id="filterFns"
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
          initialSelectedItems={filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={handleChangeFilterParams}
          placeholder={t('Enter one or more options...') as string}
        />
      )}
      <div className="flex min-h-[31px] items-start justify-center bg-layer-3 px-2 py-[5.5px]">
        <div className="flex gap-2">
          <IconCheck
            onClick={handleSaveFilter}
            className={classNames(
              filterFunction !== emptySelector
                ? 'cursor-pointer text-secondary hover:text-accent-primary'
                : 'cursor-not-allowed text-controls-disable',
            )}
            size={18}
          />
          <IconX
            className="cursor-pointer text-secondary hover:text-accent-primary"
            size={18}
            onClick={onCloseFilter}
          />
        </div>
      </div>
    </div>
  );
}
