import { IconCheck, IconX } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { translate } from '@/src/utils/app/translation';

import { ModalState } from '@/src/types/modal';
import {
  PublicationFunctions,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Modal from '../../Common/Modal';
import { MultipleComboBox } from '../../Common/MultipleComboBox';
import { RegexParamInput } from './RegexParamInput';
import { RulesSelect } from './RulesSelect';

const emptySelector = translate('Select');

interface Props {
  onSaveFilter: (filter: TargetAudienceFilter) => void;
  onCloseFilter: () => void;
}

const getPreparedFilterParams = (
  filterFunction: PublicationFunctions,
  {
    filterParams,
    filterRegexParam,
  }: {
    filterParams: string[];
    filterRegexParam: string;
  },
) => {
  switch (filterFunction) {
    case PublicationFunctions.Regex:
      return [filterRegexParam];
    // TODO: uncomment when it will be supported on core
    // case PublicationFunctions.True:
    // case PublicationFunctions.False:
    //   return [];
    default:
      return filterParams.map((param) => param.trim());
  }
};

const getItemLabel = (item: string) => item;

const filterFunctionValues = [
  PublicationFunctions.Contain,
  PublicationFunctions.Equal,
  PublicationFunctions.Regex,
  // TODO: uncomment when it will be supported on core
  // PublicationFunctions.True,
  // PublicationFunctions.False,
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

    const preparedFilterParams = getPreparedFilterParams(
      filterFunction as PublicationFunctions,
      {
        filterParams,
        filterRegexParam,
      },
    );

    onSaveFilter({
      id: selectedTarget,
      filterFunction: filterFunction as PublicationFunctions,
      filterParams: preparedFilterParams,
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

  const isTargetAndFunctionSelected =
    selectedTarget !== emptySelector && filterFunction !== emptySelector;
  const areSomeFilterParamSelected = filterParams.length || filterRegexParam;
  const isRegexFilledInButNotSelected = !!(
    filterRegexParam &&
    filterFunction !== PublicationFunctions.Regex &&
    !filterParams.length
  );
  const isParamsFilledInButRegexIsSelected = !!(
    filterParams.length &&
    filterFunction === PublicationFunctions.Regex &&
    !filterRegexParam
  );
  const isSaveBtnDisabled =
    !isTargetAndFunctionSelected ||
    !areSomeFilterParamSelected ||
    isRegexFilledInButNotSelected ||
    isParamsFilledInButRegexIsSelected;

  // TODO: uncomment when it will be supported on core
  // const isTrueOrFalseFilterSelected =
  //   filterFunction === PublicationFunctions.True ||
  //   filterFunction === PublicationFunctions.False;
  // const isSaveBtnDisabled = isTrueOrFalseFilterSelected
  //   ? !isTargetAndFunctionSelected
  //   : !isTargetAndFunctionSelected ||
  //     !areSomeFilterParamSelected ||
  //     isRegexFilledInButNotSelected ||
  //     isParamsFilledInButRegexIsSelected;

  if (isSmallScreen()) {
    return (
      <Modal
        portalId="theme-main"
        dataQa="mobile-filters-select"
        containerClassName="inline-block flex flex-col w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 h-full xl:max-w-[720px] 2xl:max-w-[780px]"
        state={ModalState.OPENED}
        heading={t('Add filter')}
        onClose={onCloseFilter}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t('Category')}
                <span className="ml-1 inline text-accent-primary">*</span>
              </label>
              <RulesSelect
                triggerClassName="h-[38px] items-center rounded border border-primary font-semibold"
                filters={publicationFilters}
                selectedFilter={selectedTarget}
                capitalizeFirstLetters
                onChangeFilter={handleChangeTarget}
                id="targets"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t('Condition')}
                <span className="ml-1 inline text-accent-primary">*</span>
              </label>
              <RulesSelect
                triggerClassName="h-[38px] items-center rounded border border-primary italic"
                filters={filterFunctionValues}
                selectedFilter={filterFunction}
                onChangeFilter={handleChangeFilterFunction}
                id="filterFns"
              />
            </div>
            {/* TODO: uncomment when it will be supported on core */}
            {/* {!isTrueOrFalseFilterSelected && ( */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t('Options')}
                <span className="ml-1 inline text-accent-primary">*</span>
              </label>
              {filterFunction === PublicationFunctions.Regex ? (
                <RegexParamInput
                  regEx={filterRegexParam}
                  onRegExChange={handleChangeFilterRegexParam}
                  className="h-[38px] rounded border border-primary"
                />
              ) : (
                <MultipleComboBox
                  className="flex min-h-[38px] items-center rounded border border-primary"
                  initialSelectedItems={filterParams}
                  getItemLabel={getItemLabel}
                  getItemValue={getItemLabel}
                  onChangeSelectedItems={handleChangeFilterParams}
                  placeholder={t('Enter one or more options...') as string}
                />
              )}
            </div>
          </div>
          {/* )} */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveFilter}
              className="button button-primary flex h-[38px] items-center"
              disabled={isSaveBtnDisabled}
            >
              {t('Add filter')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="flex gap-[1px]" data-qa="publish-audience-filter-selectors">
      <RulesSelect
        menuClassName="max-w-full font-semibold md:max-w-[145px]"
        filters={publicationFilters}
        selectedFilter={selectedTarget}
        capitalizeFirstLetters
        onChangeFilter={handleChangeTarget}
        id="targets"
      />
      <RulesSelect
        menuClassName="max-w-full italic md:max-w-[100px]"
        // TODO: uncomment when it will be supported on core
        // menuClassName={classNames(
        //   'max-w-full italic',
        //   !isTrueOrFalseFilterSelected && 'md:max-w-[100px]',
        // )}
        filters={filterFunctionValues}
        selectedFilter={filterFunction}
        onChangeFilter={handleChangeFilterFunction}
        id="filterFns"
      />
      {/* TODO: uncomment when it will be supported on core */}
      {/* {!isTrueOrFalseFilterSelected && */}
      {filterFunction === PublicationFunctions.Regex ? (
        <RegexParamInput
          regEx={filterRegexParam}
          onRegExChange={handleChangeFilterRegexParam}
        />
      ) : (
        <MultipleComboBox
          className="!bg-layer-3"
          initialSelectedItems={filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={handleChangeFilterParams}
          fontSize="text-xs"
          placeholder={t('Enter one or more options...') as string}
        />
      )}
      {/* } */}
      <div className="flex min-h-[31px] items-start justify-center bg-layer-3 px-2 py-[5.5px]">
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
