import { IconCheck, IconChevronUp, IconClipboardX } from '@tabler/icons-react';
import { memo, useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceFilters } from '@/src/types/marketplace';
import { MarketplacePanelState } from '@/src/types/marketplace-panel-state';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceSelectors,
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { SideBarI18nKeys } from '@/src/constants/i18n';
import {
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceEntitiesTabs,
  SourceType,
} from '@/src/constants/marketplace';

import { Loader } from '@/src/components/Common/Loader';
import { ResizableSidebarWrapper } from '@/src/components/Sidebar/ResizableSidebarWrapper';

import { translateEntityTypeFilterLabel } from './translateEntityTypeFilterLabel';

import { DialButton, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface FilterItemProps {
  type: FilterTypes;
  filterValue: string;
  selected: boolean;
  displayValue?: string;
  onSelect: (type: FilterTypes, value: string) => void;
}

const FilterItem = ({
  type,
  filterValue,
  selected,
  displayValue,
  onSelect,
}: FilterItemProps) => {
  return (
    <label
      className="relative flex size-[18px] w-full shrink-0 cursor-pointer items-center"
      data-qa="filter-option"
    >
      <input
        className="checkbox peer size-[18px] bg-layer-3"
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(type, filterValue)}
      />
      <IconCheck
        size={18}
        className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
      />

      <DialEllipsisTooltip
        text={displayValue ?? filterValue}
        id="option-label"
      />
    </label>
  );
};

interface FilterSectionProps {
  sectionName: string;
  panelCollapseState: MarketplacePanelState;
  selectedFilters: MarketplaceFilters;
  filterValues: string[];
  filterType: FilterTypes;
  onToggleFilterSection: (filterType: FilterTypes) => void;
  onApplyFilter: (type: FilterTypes, value: string) => void;
  getDisplayLabel?: (value: string) => string;
}

const FilterSection = ({
  filterType,
  sectionName,
  selectedFilters,
  filterValues,
  panelCollapseState,
  onToggleFilterSection,
  onApplyFilter,
  getDisplayLabel,
}: FilterSectionProps) => {
  if (!filterValues.length) {
    return null;
  }

  const sectionNameWithCount = (
    <div className="flex items-center gap-1">
      {sectionName}
      {selectedFilters[filterType].length > 0 && (
        <div
          className="flex h-[14px] min-w-[14px] items-center justify-center rounded bg-icon-accent-primary px-1 text-xxs font-semibold text-layer-3"
          data-qa="filter-selected-count"
        >
          <div> {selectedFilters[filterType].length}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="px-5 py-2.5" data-qa="marketplace-filter">
      <DialButton
        onClick={() => onToggleFilterSection(filterType)}
        className="flex h-fit w-full justify-between px-0"
        data-qa="filter-property"
        aria-expanded={panelCollapseState[filterType]}
        label={sectionNameWithCount}
        iconAfter={
          <IconChevronUp
            className={classNames(
              'duration-200',
              !panelCollapseState[filterType] && 'rotate-180',
            )}
            size={18}
          />
        }
      />
      {panelCollapseState[filterType] && (
        <div
          className="mt-3.5 flex flex-col gap-3.5"
          data-qa="filter-property-options"
        >
          {filterValues.map((value) => (
            <FilterItem
              key={value}
              type={filterType}
              filterValue={value}
              displayValue={getDisplayLabel?.(value) ?? value}
              onSelect={onApplyFilter}
              selected={selectedFilters[filterType].includes(value)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FiltersRendererProps {
  showEntityTypesSection: boolean;
  showLoader: boolean;
  panelCollapseState: MarketplacePanelState;
  selectedFilters: MarketplaceFilters;
  topics: string[];
  sourceTypes: SourceType[];
  authTypes: string[];
  handleToggleFilterSection: (filterType: FilterTypes) => void;
  handleApplyFilter: (type: FilterTypes, value: string) => void;
}
function FiltersRenderer({
  showLoader,
  showEntityTypesSection,
  panelCollapseState,
  selectedFilters,
  topics,
  sourceTypes,
  authTypes,
  handleToggleFilterSection,
  handleApplyFilter,
}: FiltersRendererProps) {
  const { t } = useTranslation(Translation.SideBar);
  const router = useRouter();

  const getEntityTypeLabel = useCallback(
    (value: string) => translateEntityTypeFilterLabel(value, router.locale, t),
    [router.locale, t],
  );

  if (showLoader) {
    return <Loader />;
  }

  return (
    <div className="flex grow flex-col divide-y divide-tertiary overflow-y-auto">
      {showEntityTypesSection && (
        <FilterSection
          sectionName={t(SideBarI18nKeys.Type)}
          filterValues={ENTITY_TYPES}
          panelCollapseState={panelCollapseState}
          selectedFilters={selectedFilters}
          filterType={FilterTypes.ENTITY_TYPE}
          onToggleFilterSection={handleToggleFilterSection}
          onApplyFilter={handleApplyFilter}
          getDisplayLabel={getEntityTypeLabel}
        />
      )}
      <FilterSection
        sectionName={t(SideBarI18nKeys.Topics)}
        filterValues={topics}
        panelCollapseState={panelCollapseState}
        selectedFilters={selectedFilters}
        filterType={FilterTypes.TOPICS}
        onToggleFilterSection={handleToggleFilterSection}
        onApplyFilter={handleApplyFilter}
      />
      {sourceTypes.length > 1 && (
        <FilterSection
          sectionName={t(SideBarI18nKeys.Sources)}
          filterValues={sourceTypes}
          panelCollapseState={panelCollapseState}
          selectedFilters={selectedFilters}
          filterType={FilterTypes.SOURCES}
          onToggleFilterSection={handleToggleFilterSection}
          onApplyFilter={handleApplyFilter}
        />
      )}
      <FilterSection
        sectionName={t(SideBarI18nKeys.Authentication)}
        filterValues={authTypes}
        panelCollapseState={panelCollapseState}
        selectedFilters={selectedFilters}
        filterType={FilterTypes.AUTH}
        onToggleFilterSection={handleToggleFilterSection}
        onApplyFilter={handleApplyFilter}
      />
    </div>
  );
}

export const MarketplaceFilterbar = memo(() => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const areModelsLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);
  const areToolsetsLoaded = useAppSelector(
    ToolsetSelectors.selectAreToolsetsLoaded,
  );

  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );

  const selectedTab = useAppSelector(
    MarketplaceSelectors.selectSelectedEntitiesTab,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const {
    topicsFilters,
    sourcesFilters,
    authFilters,
    selectedFilters,
    showLoader,
    setFilters,
  } = useAppSelector(MarketplaceSelectors.selectFiltersContent);

  const isAgentsTab = selectedTab === MarketplaceEntitiesTabs.AGENTS;

  const panelCollapseState = useAppSelector(
    isAgentsTab
      ? UISelectors.selectAgentsFilterPanelCollapseState
      : UISelectors.selectToolsetFilterPanelCollapseState,
  );

  const handleApplyFilter = useCallback(
    (type: FilterTypes, value: string) => {
      dispatch(
        setFilters({
          filterType: type,
          value,
        }),
      );
    },
    [dispatch, setFilters],
  );

  const handleToggleFilterSection = useCallback(
    (filterType: FilterTypes) => {
      if (isAgentsTab) {
        dispatch(
          UIActions.setAgentsFilterPanelCollapseState({
            ...panelCollapseState,
            [filterType]: !panelCollapseState[filterType],
          }),
        );
      } else {
        dispatch(
          UIActions.setToolsetFilterPanelCollapseState({
            ...panelCollapseState,
            [filterType]: !panelCollapseState[filterType],
          }),
        );
      }
    },
    [isAgentsTab, dispatch, panelCollapseState],
  );

  const handleClose = useCallback(() => {
    dispatch(UIActions.setShowMarketplaceFilterbar(false));
  }, [dispatch]);

  const noEntities = useMemo(() => {
    return (
      !Object.values(isAgentsTab ? modelsMap : toolsetsMap).length &&
      areModelsLoaded &&
      areToolsetsLoaded
    );
  }, [areModelsLoaded, areToolsetsLoaded, isAgentsTab, modelsMap, toolsetsMap]);

  if (!showFilterbar) {
    return null;
  }

  return (
    <ResizableSidebarWrapper
      dataQa="marketplace-sidebar"
      isLeftSidebar
      handleClose={handleClose}
    >
      <>
        <div
          className={classNames(
            'flex items-center justify-between px-5',
            isOverlay ? 'min-h-[35px]' : 'min-h-12',
          )}
        >
          <p className="text-base font-semibold">
            {t(SideBarI18nKeys.FiltersSideBar)}
          </p>
        </div>
        {noEntities ? (
          <div className="flex grow flex-col items-center justify-center gap-3">
            <IconClipboardX
              size={60}
              strokeWidth={0.5}
              className="text-secondary"
            />
            <p className="mx-auto max-w-[11.5rem] px-4 text-center text-sm leading-relaxed text-primary">
              {t(
                isAgentsTab
                  ? SideBarI18nKeys.NoFiltersAgents
                  : SideBarI18nKeys.NoFiltersToolsets,
              )}
            </p>
          </div>
        ) : (
          <FiltersRenderer
            showEntityTypesSection={isAgentsTab}
            showLoader={showLoader}
            panelCollapseState={panelCollapseState}
            selectedFilters={selectedFilters}
            topics={topicsFilters}
            sourceTypes={sourcesFilters}
            authTypes={authFilters}
            handleToggleFilterSection={handleToggleFilterSection}
            handleApplyFilter={handleApplyFilter}
          />
        )}
      </>
    </ResizableSidebarWrapper>
  );
});

MarketplaceFilterbar.displayName = 'MarketplaceFilterbar';
