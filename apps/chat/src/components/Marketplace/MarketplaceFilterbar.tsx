import {
  IconArrowLeft,
  IconCheck,
  IconChevronUp,
  IconHome,
  IconLayoutGrid,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX, useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FilterTypes, MarketplaceTabs } from '@/src/constants/marketplace';

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
  const id = useMemo(() => `${type}-${filterValue}`, []);
  return (
    <div
      className="relative flex size-[18px] shrink-0 items-center"
      data-qa="filter-option"
    >
      <input
        className="checkbox peer size-[18px] bg-layer-3"
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(type, filterValue)}
        id={id}
      />
      <IconCheck
        size={18}
        className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
      />
      <label htmlFor={id} className="ml-2 whitespace-nowrap text-sm">
        {displayValue ?? filterValue}
      </label>
    </div>
  );
};

interface FilterSectionProps {
  sectionName: string;
  openedSections: Record<FilterTypes, boolean>;
  selectedFilters: {
    Type: string[];
    Topics: string[];
  };
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
      <button
        onClick={() => onToggleFilterSection(filterType)}
        className="flex w-full justify-between font-semibold"
        data-qa="filter-property"
      >
        <h5 className="text-sm">{sectionName}</h5>
        <IconChevronUp
          className={classNames(
            'duration-200',
            !openedSections[filterType] && 'rotate-180',
          )}
          size={18}
        />
      </button>
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

const entityTypes = [
  EntityType.Model,
  EntityType.Assistant,
  EntityType.Application,
];

interface ActionButtonProps {
  isOpen: boolean;
  onClick: () => void;
  caption: string;
  Icon: (props: TablerIconsProps) => JSX.Element;
  selected?: boolean;
  dataQa?: string;
}

const ActionButton = ({
  isOpen,
  onClick,
  caption,
  Icon,
  selected,
  dataQa,
}: ActionButtonProps) => {
  return (
    <div className="flex px-2 py-1">
      <button
        onClick={onClick}
        className={classNames(
          'flex min-h-9 shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-4 py-2 transition-colors duration-200 hover:bg-accent-primary-alpha hover:disabled:bg-transparent',
          {
            'bg-accent-primary-alpha': selected,
          },
        )}
        data-qa={dataQa}
      >
        <Icon className="text-secondary" width={18} height={18} />
        {isOpen ? caption : ''}
      </button>
    </div>
  );
};

const getTypeLabel = (value: string) => `${capitalize(value)}s`;

export const MarketplaceFilterbar = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const topics = useAppSelector(ModelsSelectors.selectModelTopics);

  const [openedSections, setOpenedSections] = useState({
    [FilterTypes.ENTITY_TYPE]: true,
    // [FilterTypes.CAPABILITIES]: false,
    // [FilterTypes.ENVIRONMENT]: false,
    [FilterTypes.TOPICS]: true,
  });

  const handleApplyFilter = (type: FilterTypes, value: string) => {
    dispatch(
      MarketplaceActions.setSelectedFilters({ filterType: type, value }),
    );
  };

  const handleChangeTab = useCallback(
    (tab: MarketplaceTabs) => {
      dispatch(MarketplaceActions.setSelectedTab(tab));
    },
    [dispatch],
  );

  const handleHomeClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.HOME),
    [handleChangeTab],
  );

  const handleMyAppsClick = useCallback(
    () => handleChangeTab(MarketplaceTabs.MY_APPLICATIONS),
    [handleChangeTab],
  );

  const handleToggleFilterSection = (filterType: FilterTypes) => {
    setOpenedSections((state) => ({
      ...openedSections,
      [filterType]: !state[filterType],
    }));
  };
  return (
    <nav
      className={classNames(
        showFilterbar ? 'w-[284px]' : 'invisible md:visible md:w-[64px]',
        'group/sidebar absolute left-0 top-0 z-40 h-full shrink-0 flex-col gap-px divide-y divide-tertiary bg-layer-3 md:sticky md:z-0',
      )}
      data-qa="marketplace-sidebar"
    >
      <div>
        <ActionButton
          isOpen={showFilterbar}
          onClick={() => router.push('/')}
          caption={t('Back to Chat')}
          Icon={IconArrowLeft}
          dataQa="back-to-chat"
        />
        <ActionButton
          isOpen={showFilterbar}
          onClick={handleHomeClick}
          caption={t('Home page')}
          Icon={IconHome}
          selected={selectedTab === MarketplaceTabs.HOME}
          dataQa="home-page"
        />
        <ActionButton
          isOpen={showFilterbar}
          onClick={handleMyAppsClick}
          caption={t('My applications')}
          Icon={IconLayoutGrid}
          selected={selectedTab === MarketplaceTabs.MY_APPLICATIONS}
          dataQa="my-applications"
        />
      </div>
      {showFilterbar && (
        <>
          <FilterSection
            sectionName={t('Type')}
            filterValues={entityTypes}
            openedSections={openedSections}
            selectedFilters={selectedFilters}
            filterType={FilterTypes.ENTITY_TYPE}
            onToggleFilterSection={handleToggleFilterSection}
            onApplyFilter={handleApplyFilter}
            getDisplayLabel={getTypeLabel}
          />
          <FilterSection
            sectionName={t('Topics')}
            filterValues={topics} // topics
            openedSections={openedSections}
            selectedFilters={selectedFilters}
            filterType={FilterTypes.TOPICS}
            onToggleFilterSection={handleToggleFilterSection}
            onApplyFilter={handleApplyFilter}
          />
        </>
      )}
    </nav>
  );
};
