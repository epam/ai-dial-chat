import { IconCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { ModalState } from '@/src/types/modal';
import {
  PublicationFunctions,
  TargetAudienceFilterData,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys, SideBarI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { Modal } from '@/src/components/Common/Modal';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import { RegexParamInput } from './RegexParamInput';
import { RulesSelect } from './RulesSelect';
import { usePublicationFilterTranslation } from './usePublicationFilterTranslation';

import {
  DialPrimaryButton,
  DialPrimaryIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';

const emptySelector: string = SideBarI18nKeys.Select;

interface Props {
  onSaveFilter: (filter: TargetAudienceFilterData) => void;
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
    default:
      return filterParams.map((param) => param.trim());
  }
};

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
  const { t: tChat } = useTranslation(Translation.Chat);
  const { translateSource, translateFunction } =
    usePublicationFilterTranslation();

  const [filterFunction, setFilterFunction] = useState<PublicationFunctions>(
    PublicationFunctions.Contain,
  );
  const [filterParams, setFilterParams] = useState<string[]>([]);
  const [filterRegexParam, setFilterRegexParam] = useState<string>('');
  const [isRegexValid, setIsRegexValid] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState(t(emptySelector));
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [filterFnsMenuOpen, setFilterFnsMenuOpen] = useState(false);

  const filterRowRef = useRef<HTMLDivElement>(null);
  const valuesInputRef = useRef<HTMLInputElement>(null);
  const regexInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedTargetRef = useRef(selectedTarget);
  const isSaveBtnDisabledRef = useRef(true);

  const publicationFilters = useAppSelector(
    SettingsSelectors.selectPublicationFilters,
  );

  const emptyTargetLabel = t(emptySelector);

  const formatSourceLabel = useCallback(
    (source: string) => {
      if (source === emptySelector || source === emptyTargetLabel) {
        return emptyTargetLabel;
      }

      return translateSource(source);
    },
    [emptyTargetLabel, translateSource],
  );

  const formatFunctionLabel = useCallback(
    (filterType: string) => translateFunction(filterType),
    [translateFunction],
  );

  const handleSaveFilter = useCallback(() => {
    if (!onSaveFilter) return;

    const preparedFilterParams = getPreparedFilterParams(filterFunction, {
      filterParams,
      filterRegexParam,
    });

    onSaveFilter({
      source: selectedTarget,
      filterFunction,
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
    setTargetMenuOpen(false);
  }, []);

  const handleChangeFilterFunction = useCallback(
    (next: PublicationFunctions) => {
      setFilterFunction(next);
      if (next !== PublicationFunctions.Regex) {
        setIsRegexValid(true);
      }
    },
    [],
  );

  const handleChangeFilterParams = useCallback((params: string[]) => {
    setFilterParams(params);
  }, []);

  const handleChangeFilterRegexParam = useCallback(
    (filterRegexParam: string) => {
      setFilterRegexParam(filterRegexParam);
    },
    [],
  );

  const isTargetUnselected =
    selectedTarget === emptySelector || selectedTarget === emptyTargetLabel;
  const isTargetSelected = !isTargetUnselected;
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
    !isTargetSelected ||
    !areSomeFilterParamSelected ||
    isRegexFilledInButNotSelected ||
    isParamsFilledInButRegexIsSelected ||
    (filterFunction === PublicationFunctions.Regex && !isRegexValid);

  isSaveBtnDisabledRef.current = isSaveBtnDisabled;

  const handleTargetMenuOpenChange = useCallback((open: boolean) => {
    setTargetMenuOpen(open);
    if (open) {
      setFilterFnsMenuOpen(false);
    }
  }, []);

  const handleFilterFnsMenuOpenChange = useCallback((open: boolean) => {
    setFilterFnsMenuOpen(open);
    if (open) {
      setTargetMenuOpen(false);
    }
  }, []);

  const targetMenuControlProps = isTargetUnselected
    ? {
        isMenuOpen: targetMenuOpen,
        onMenuOpenChange: handleTargetMenuOpenChange,
      }
    : {};

  useEffect(() => {
    const wasEmpty = prevSelectedTargetRef.current === emptySelector;
    const nowSet = selectedTarget !== emptySelector;
    if (wasEmpty && nowSet) {
      queueMicrotask(() => {
        if (filterFunction === PublicationFunctions.Regex) {
          regexInputRef.current?.focus();
        } else {
          valuesInputRef.current?.focus();
        }
      });
    }
    prevSelectedTargetRef.current = selectedTarget;
  }, [selectedTarget, filterFunction]);

  useEffect(() => {
    if (isSmallScreen()) {
      return;
    }

    // Outside the filter row: commit if valid, otherwise discard. Clicks inside
    // portaled dropdown lists are ignored so items stay selectable. If a menu is
    // open but the row is incomplete, this still discards per product rules.
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (filterRowRef.current?.contains(el)) {
        return;
      }
      if (el.closest('[data-qa="dropdown-menu"]')) {
        return;
      }
      if (!isSaveBtnDisabledRef.current) {
        handleSaveFilter();
      } else {
        onCloseFilter();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, [handleSaveFilter, onCloseFilter]);

  if (isSmallScreen()) {
    return (
      <Modal
        portalId="theme-main"
        dataQa="mobile-filters-select"
        containerClassName="inline-block flex flex-col w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 h-full xl:max-w-[720px] 2xl:max-w-[780px]"
        state={ModalState.OPENED}
        heading={t(SideBarI18nKeys.AddFilter)}
        onClose={onCloseFilter}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t(SideBarI18nKeys.Category)}
                <span className="ms-1 inline text-accent-primary">*</span>
              </label>
              <RulesSelect
                triggerClassName="h-[38px] items-center rounded border border-primary font-semibold"
                filters={publicationFilters}
                selectedFilter={selectedTarget}
                onChangeFilter={handleChangeTarget}
                formattingFunction={formatSourceLabel}
                id="targets"
                {...targetMenuControlProps}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t(SideBarI18nKeys.Condition)}
                <span className="ms-1 inline text-accent-primary">*</span>
              </label>
              <RulesSelect
                triggerClassName="h-[38px] items-center rounded border border-primary italic"
                filters={filterFunctionValues}
                selectedFilter={filterFunction}
                onChangeFilter={handleChangeFilterFunction}
                formattingFunction={formatFunctionLabel}
                id="filterFns"
                isMenuOpen={filterFnsMenuOpen}
                onMenuOpenChange={handleFilterFnsMenuOpenChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t(SideBarI18nKeys.Options)}
                <span className="ms-1 inline text-accent-primary">*</span>
              </label>
              {filterFunction === PublicationFunctions.Regex ? (
                <RegexParamInput
                  regEx={filterRegexParam}
                  onRegExChange={handleChangeFilterRegexParam}
                  onValidityChange={setIsRegexValid}
                  isInvalid={!isRegexValid}
                  className="rounded border border-primary"
                  inputRef={regexInputRef}
                />
              ) : (
                <MultipleComboBox
                  className="flex min-h-[38px] items-start rounded  border border-primary sm:items-center"
                  initialSelectedItems={filterParams}
                  getItemLabel={getItemLabel}
                  getItemValue={getItemLabel}
                  onChangeSelectedItems={handleChangeFilterParams}
                  placeholder={t(SideBarI18nKeys.EnterOneOrMoreOptions)}
                  inputRef={valuesInputRef}
                  hasDeleteAll
                  closeButtonClassName="pt-1 pe-1"
                  showConnectorBetweenSelectedItems
                  connectorLabel={tChat(ChatI18nKeys.Or)}
                />
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <DialPrimaryButton
              label={t(SideBarI18nKeys.AddFilter)}
              onClick={handleSaveFilter}
              disabled={isSaveBtnDisabled}
            />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div
      ref={filterRowRef}
      className="flex gap-px"
      data-qa="publish-audience-filter-selectors"
    >
      <RulesSelect
        menuClassName="max-w-full font-semibold md:max-w-[145px]"
        filters={publicationFilters}
        selectedFilter={selectedTarget}
        onChangeFilter={handleChangeTarget}
        formattingFunction={formatSourceLabel}
        id="targets"
        {...targetMenuControlProps}
      />
      <RulesSelect
        menuClassName="max-w-full italic md:max-w-[100px]"
        filters={filterFunctionValues}
        selectedFilter={filterFunction}
        formattingFunction={formatFunctionLabel}
        onChangeFilter={handleChangeFilterFunction}
        id="filterFns"
        isMenuOpen={filterFnsMenuOpen}
        onMenuOpenChange={handleFilterFnsMenuOpenChange}
      />
      {filterFunction === PublicationFunctions.Regex ? (
        <RegexParamInput
          regEx={filterRegexParam}
          onRegExChange={handleChangeFilterRegexParam}
          onValidityChange={setIsRegexValid}
          isInvalid={!isRegexValid}
          inputRef={regexInputRef}
        />
      ) : (
        <MultipleComboBox
          className="!bg-layer-3"
          initialSelectedItems={filterParams}
          getItemLabel={getItemLabel}
          getItemValue={getItemLabel}
          onChangeSelectedItems={handleChangeFilterParams}
          fontSize="text-xs"
          placeholder={t(SideBarI18nKeys.EnterOneOrMoreOptions)}
          dataQa="filter-values-container"
          inputRef={valuesInputRef}
          showConnectorBetweenSelectedItems
          connectorLabel={tChat(ChatI18nKeys.Or)}
        />
      )}
      <div className="flex min-h-[31px] gap-2 bg-layer-3 px-2 py-[3.5px]">
        <CloseButtonSmall onClick={onCloseFilter} data-qa="cancel-filter" />
        <DialPrimaryIconButton
          size={ElementSize.Small}
          data-qa="save-filter"
          onClick={handleSaveFilter}
          tooltipProps={{
            tooltip: t(SideBarI18nKeys.AddFilter),
            isTriggerClickable: true,
            triggerClassName: classNames(
              isSaveBtnDisabled && 'hover:text-controls-disable',
            ),
          }}
          disabled={isSaveBtnDisabled}
          icon={
            <IconCheck
              size={DEFAULT_ICON_SIZES.SMALL}
              className={classNames(
                isSaveBtnDisabled && 'hover:text-controls-disable',
              )}
            />
          }
        />
      </div>
    </div>
  );
}
