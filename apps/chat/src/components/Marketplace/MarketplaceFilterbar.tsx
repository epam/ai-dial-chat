import { IconCheck, IconChevronUp, IconClipboardX } from '@tabler/icons-react';
import { memo, useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceFilters } from '@/src/types/marketplace';
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

import {
  ENTITY_TYPES,
  FilterTypes,
  MarketplaceEntitiesTabs,
  SourceType,
} from '@/src/constants/marketplace';

import { CloseSidebarButton } from '@/src/components/Buttons/CloseSidebarButton';
import { Loader } from '@/src/components/Common/Loader';

import { DialButton } from '@epam/ai-dial-ui-kit';
import { capitalize } from 'lodash';

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
      <span className="ml-2 whitespace-nowrap text-sm" data-qa="option-label">
        {displayValue ?? filterValue}
      </span>
    </label>
  );
};

interface FilterSectionProps {
  sectionName: string;
  openedSections: Record<FilterTypes, boolean>;
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
  openedSections,
  onToggleFilterSection,
  onApplyFilter,
  getDisplayLabel,
}: FilterSectionProps) => {
  if (!filterValues.length) {
    return null;
  }
  return (
    <div className="px-5 py-2.5" data-qa="marketplace-filter">
      <DialButton
        onClick={() => onToggleFilterSection(filterType)}
        className="flex w-full justify-between"
        data-qa="filter-property"
        aria-expanded={openedSections[filterType]}
        label={sectionName}
        iconAfter={
          <IconChevronUp
            className={classNames(
              'duration-200',
              !openedSections[filterType] && 'rotate-180',
            )}
            size={18}
          />
        }
      />
      {openedSections[filterType] && (
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

interface OpenedSections {
  [FilterTypes.ENTITY_TYPE]: boolean;
  // [FilterTypes.CAPABILITIES]: boolean;
  // [FilterTypes.ENVIRONMENT]: boolean;
  [FilterTypes.TOPICS]: boolean;
  [FilterTypes.SOURCES]: boolean;
}
interface FiltersRendererProps {
  showEntityTypesSection: boolean;
  showLoader: boolean;
  openedSections: OpenedSections;
  selectedFilters: MarketplaceFilters;
  topics: string[];
  sourceTypes: SourceType[];
  handleToggleFilterSection: (filterType: FilterTypes) => void;
  handleApplyFilter: (type: FilterTypes, value: string) => void;
}
function FiltersRenderer({
  showLoader,
  showEntityTypesSection,
  openedSections,
  selectedFilters,
  topics,
  sourceTypes,
  handleToggleFilterSection,
  handleApplyFilter,
}: FiltersRendererProps) {
  const { t } = useTranslation(Translation.SideBar);

  if (showLoader) {
    return <Loader />;
  }

  return (
    <>
      {showEntityTypesSection && (
        <FilterSection
          sectionName={t('Type')}
          filterValues={ENTITY_TYPES}
          openedSections={openedSections}
          selectedFilters={selectedFilters}
          filterType={FilterTypes.ENTITY_TYPE}
          onToggleFilterSection={handleToggleFilterSection}
          onApplyFilter={handleApplyFilter}
          getDisplayLabel={getTypeLabel}
        />
      )}
      <FilterSection
        sectionName={t('Topics')}
        filterValues={topics}
        openedSections={openedSections}
        selectedFilters={selectedFilters}
        filterType={FilterTypes.TOPICS}
        onToggleFilterSection={handleToggleFilterSection}
        onApplyFilter={handleApplyFilter}
      />
      {sourceTypes.length > 1 && (
        <FilterSection
          sectionName={t('Sources')}
          filterValues={sourceTypes}
          openedSections={openedSections}
          selectedFilters={selectedFilters}
          filterType={FilterTypes.SOURCES}
          onToggleFilterSection={handleToggleFilterSection}
          onApplyFilter={handleApplyFilter}
        />
      )}
    </>
  );
}

const getTypeLabel = (value: string) => `${capitalize(value)}s`;

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
    selectedFilters,
    showLoader,
    setFilters,
  } = useAppSelector(MarketplaceSelectors.selectFiltersContent);

  const isAgentsTab = selectedTab === MarketplaceEntitiesTabs.AGENTS;

  const [openedSections, setOpenedSections] = useState<OpenedSections>({
    [FilterTypes.ENTITY_TYPE]: true,
    // [FilterTypes.CAPABILITIES]: false,
    // [FilterTypes.ENVIRONMENT]: false,
    [FilterTypes.TOPICS]: true,
    [FilterTypes.SOURCES]: true,
  });

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
      setOpenedSections((state) => ({
        ...openedSections,
        [filterType]: !state[filterType],
      }));
    },
    [openedSections],
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

  return (
    <nav
      className={classNames(
        showFilterbar ? 'w-[320px] xl:w-[260px]' : 'invisible',
        'group/sidebar absolute left-0 top-0 z-40 flex h-full shrink-0 flex-col gap-px border-r border-tertiary bg-layer-3  xl:sticky xl:left-0 xl:z-0',
        isOverlay ? 'md:left-[44px]' : 'md:left-[60px]',
      )}
      data-qa="marketplace-sidebar"
    >
      <CloseSidebarButton isLeftSide onClose={handleClose} />
      {showFilterbar && (
        <div className="flex h-full flex-col divide-y divide-tertiary overflow-y-auto">
          <div
            className={classNames(
              'flex items-center justify-between px-5',
              isOverlay ? 'min-h-[35px]' : 'min-h-12',
            )}
          >
            <p className="text-base font-semibold">{t('Filters')}</p>
          </div>
          {noEntities ? (
            <div className="flex grow flex-col items-center justify-center gap-3">
              <IconClipboardX
                size={60}
                strokeWidth={0.5}
                className="text-secondary"
              />
              <p className="text-center text-sm leading-[24px] text-primary">
                {t(
                  `No filters as you currently have no ${isAgentsTab ? 'agents' : 'toolsets'}`,
                )}
              </p>
            </div>
          ) : (
            <FiltersRenderer
              showEntityTypesSection={isAgentsTab}
              showLoader={showLoader}
              openedSections={openedSections}
              selectedFilters={selectedFilters}
              topics={topicsFilters}
              sourceTypes={sourcesFilters}
              handleToggleFilterSection={handleToggleFilterSection}
              handleApplyFilter={handleApplyFilter}
            />
          )}
        </div>
      )}
    </nav>
  );
});

MarketplaceFilterbar.displayName = 'MarketplaceFilterbar';
