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
  onSaveFilter?: (filter: TargetAudienceFilter) => void;
  onCloseFilter?: () => void;
}

const getItemLabel = (item: string) => item;

const filterFunctionValues = [
  PublicationFunctions.Contain,
  PublicationFunctions.Equal,
  PublicationFunctions.Regex,
];

export function TargetAudienceFilterComponent({
  onSaveFilter,
  onCloseFilter,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);

  const [filterFunction, setFilterFunction] = useState<
    PublicationFunctions | typeof emptySelector
  >(emptySelector);
  const [filterParams, setFilterParams] = useState<string[]>([]);
  const [filterRegexParam, setFilterRegexParam] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState(emptySelector);

  const publicationFilters = useAppSelector(
    SettingsSelectors.selectPublicationFilters,
  );

  const handleSaveFilter = useCallback(() => {
    if (!onSaveFilter) return;

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
  }, [
    filterFunction,
    filterParams,
    filterRegexParam,
    onSaveFilter,
    selectedTarget,
  ]);

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

  const isSaveBtnDisabled =
    selectedTarget === emptySelector || // a target is not selected
    filterFunction === emptySelector || // a filter function is not selected
    (!filterParams.length && !filterRegexParam) || // filter params are not selected and regex hasn't filled
    !!(
      // regex filled, but the regex filter function isn't selected
      (
        filterRegexParam &&
        filterFunction !== PublicationFunctions.Regex &&
        !filterParams.length
      )
    ) ||
    !!(
      // params selected, but the regex filter function isn't selected
      (
        filterParams.length &&
        filterFunction === PublicationFunctions.Regex &&
        !filterRegexParam
      )
    );

  return (
    <div
      className="grid grid-cols-5 gap-[1px] md:flex md:flex-row"
      data-qa="publish-audience-filter-selectors"
    >
      <RulesSelect
        className="-order-3 col-span-2 max-w-full font-semibold md:order-1 md:max-w-[145px]"
        filters={publicationFilters}
        selectedFilter={selectedTarget}
        capitalizeFirstLetters
        onChangeFilter={handleChangeTarget}
        id="targets"
      />
      <RulesSelect
        className="-order-2 col-span-2 max-w-full italic md:order-2 md:max-w-[100px]"
        filters={filterFunctionValues}
        selectedFilter={filterFunction}
        onChangeFilter={handleChangeFilterFunction}
        id="filterFns"
      />
      {filterFunction === PublicationFunctions.Regex ? (
        <RegexParamInput
          regEx={filterRegexParam}
          onRegExChange={handleChangeFilterRegexParam}
        />
      ) : (
        <MultipleComboBox
          initialSelectedItems={filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={handleChangeFilterParams}
          placeholder={t('Enter one or more options...') as string}
        />
      )}
      <div className="-order-1 col-span-1 flex min-h-[31px] items-start justify-center bg-layer-3 px-2 py-[5.5px] md:order-4">
        <div className="flex gap-2">
          <button
            data-qa="save-filter"
            onClick={handleSaveFilter}
            className={classNames(
              isSaveBtnDisabled
                ? 'cursor-not-allowed text-controls-disable'
                : 'text-secondary hover:text-accent-primary',
            )}
            disabled={isSaveBtnDisabled}
          >
            <IconCheck size={18} />
          </button>
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
