import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialPrimaryButton,
  DialSpinner,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { FC, useState } from 'react';
import {
  DEFAULT_DOMAIN_OPTIONS,
  DEFAULT_MATURITY_OPTIONS,
  DEFAULT_USE_CASE_OPTIONS,
} from '../../constants/catalog-defaults';
import {
  DEFAULT_ALL_FROM_IDS,
  DEFAULT_FROM_TREE,
} from '../../constants/from-tree';
import type { CatalogProps } from '../../models/catalog-props';
import { CatalogSortKey } from '../../types/sort';
import { CatalogViewMode } from '../../types/view-mode';
import { filterCatalogItems } from '../../utils/catalog-filter';
import { sortCatalogItems } from '../../utils/catalog-sort';
import { getStyles } from '../../utils/styles';
import { CatalogBrowseToolbar } from '../CatalogBrowseToolbar/CatalogBrowseToolbar';
import { CatalogCardGrid } from '../CatalogCardGrid/CatalogCardGrid';
import { CatalogFavorites } from '../CatalogFavorites/CatalogFavorites';
import { CatalogListView } from '../CatalogListView/CatalogListView';
import styles from './Catalog.module.scss';

/**
 * Root catalog component. Owns all filter/sort/pagination state and wires
 * CatalogFavorites, CatalogBrowseToolbar, CatalogCardGrid, and CatalogListView.
 * Consumers provide data via props; no direct API or context access.
 */
export const Catalog: FC<CatalogProps> = ({
  items,
  favorites,
  titles,
  onToggleFavorite,
  onCreateClick,
  isLoading,
  styles: catalogStyles,

  // TODO: review
  tabs = [],
  maturityOptions = DEFAULT_MATURITY_OPTIONS,
  useCaseOptions = DEFAULT_USE_CASE_OPTIONS,
  domainOptions = DEFAULT_DOMAIN_OPTIONS,
  fromTree = DEFAULT_FROM_TREE,
  allFromIds = DEFAULT_ALL_FROM_IDS,
}) => {
  const { typography } = catalogStyles ?? {};

  const cssVars = getStyles(catalogStyles);

  const pageTitle = titles?.pageTitle ?? 'Catalog';
  const createLabel = titles?.createLabel ?? 'Create';
  const favoritesTitle = titles?.favoritesTitle ?? 'Your Favorites';
  const browseTitle = titles?.browseTitle ?? 'Browse';
  const searchPlaceholder =
    titles?.searchPlaceholder ?? 'Search models, tools, agents…';
  const noResultsDescription =
    titles?.noResultsDescription ?? 'Try a different keyword';
  const noResultsTitle =
    titles?.noResultsTitle ?? ((q: string) => `No results for "${q}"`);
  const featuredLabel = titles?.featuredLabel ?? 'Featured';
  const resolvedAriaLabel = titles?.ariaLabel ?? 'Catalog';

  const sortOptions = [
    {
      value: CatalogSortKey.RecentlyUpdated,
      label: titles?.sortRecentlyUpdatedLabel ?? 'Recently Updated',
    },
    {
      value: CatalogSortKey.Newest,
      label: titles?.sortNewestLabel ?? 'Newest',
    },
    {
      value: CatalogSortKey.NameAZ,
      label: titles?.sortNameAZLabel ?? 'Name A-Z',
    },
  ];

  const [query, setQuery] = useState('');

  const [viewMode, setViewMode] = useState<CatalogViewMode>(
    CatalogViewMode.Grid,
  );
  const [listEverShown, setListEverShown] = useState(false);
  const [sortKey, setSortKey] = useState<string>(
    CatalogSortKey.RecentlyUpdated,
  );
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
  // TODO: review
  const [fromChecked, setFromChecked] = useState<Set<string>>(
    new Set(allFromIds),
  );
  const [domainSelected, setDomainSelected] = useState<Set<string>>(new Set());
  const [useCaseSelected, setUseCaseSelected] = useState<Set<string>>(
    new Set(),
  );
  const [maturitySelected, setMaturitySelected] = useState<Set<string>>(
    new Set(),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <DialSpinner size={44} />
      </div>
    );
  }

  const handleViewModeChange = (mode: CatalogViewMode) => {
    if (mode === CatalogViewMode.List) setListEverShown(true);
    setViewMode(mode);
  };

  const clearAllFilters = () => {
    setFromChecked(new Set(allFromIds));
    setDomainSelected(new Set());
    setUseCaseSelected(new Set());
    setMaturitySelected(new Set());
  };

  const sorted = sortCatalogItems(items, sortKey);
  const filtered = filterCatalogItems(sorted, {
    fromChecked,
    allFromIds,
    domainSelected,
    useCaseSelected,
    maturitySelected,
    query,
  });

  const isAnyFilterActive =
    fromChecked.size < allFromIds.size ||
    domainSelected.size > 0 ||
    useCaseSelected.size > 0 ||
    maturitySelected.size > 0;

  const emptyTitle = query ? noResultsTitle(query) : 'No items';
  const emptyDesc = query ? noResultsDescription : '';

  return (
    <div
      aria-label={resolvedAriaLabel}
      className="flex min-h-0 flex-1 flex-col"
      style={cssVars}
    >
      {/* Page heading */}
      <div
        className={mergeClasses(
          'flex h-16 flex-shrink-0 items-center justify-between border-b px-6 py-3',
          styles.heading,
        )}
      >
        <h1
          className={mergeClasses(
            typography?.pageHeadingFontClassName ?? 'dial-h1-text',
            styles.headingTitle,
          )}
        >
          {pageTitle}
        </h1>
        <DialPrimaryButton
          label={createLabel}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} />}
          onClick={onCreateClick}
        />
      </div>

      {/* Favorites strip */}
      {favorites.length > 0 && (
        <CatalogFavorites
          items={favorites}
          totalCount={favorites.length}
          title={favoritesTitle}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* Browse toolbar (title, view toggle, sort, search, filters, tabs) */}
      <CatalogBrowseToolbar
        totalCount={items.length}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        sortKey={sortKey}
        onSortChange={setSortKey}
        query={query}
        onQueryChange={setQuery}
        fromChecked={fromChecked}
        allFromIds={allFromIds}
        fromTree={fromTree}
        onFromChange={setFromChecked}
        domainSelected={domainSelected}
        domainOptions={domainOptions}
        onDomainChange={setDomainSelected}
        useCaseSelected={useCaseSelected}
        useCaseOptions={useCaseOptions}
        onUseCaseChange={setUseCaseSelected}
        maturitySelected={maturitySelected}
        maturityOptions={maturityOptions}
        onMaturityChange={setMaturitySelected}
        isAnyFilterActive={isAnyFilterActive}
        onClearFilters={clearAllFilters}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title={browseTitle}
        searchPlaceholder={searchPlaceholder}
        sortOptions={sortOptions}
      />

      {/* Grid view */}
      {viewMode === CatalogViewMode.Grid && (
        <div
          className={mergeClasses(
            'flex min-h-0 flex-1 overflow-auto pt-5',
            styles.gridView,
          )}
        >
          <CatalogCardGrid
            items={filtered}
            query={query}
            onToggleFavorite={onToggleFavorite}
            titles={{
              noResultsTitle: emptyTitle,
              noResultsDescription: emptyDesc,
              featuredLabel,
            }}
            styles={{
              noResultsTitleClassName: typography?.noResultsTitleClassName,
              noResultsDescriptionClassName:
                typography?.noResultsDescriptionClassName,
            }}
          />
        </div>
      )}

      {/* List view — mounted only after first shown to avoid initializing ag-grid eagerly */}
      {listEverShown && viewMode === CatalogViewMode.List && (
        <div className={mergeClasses('flex min-h-0 flex-1', styles.listView)}>
          <CatalogListView
            items={filtered}
            query={query}
            ariaLabel={resolvedAriaLabel}
            emptyStateTitle={emptyTitle}
            emptyStateDescription={emptyDesc}
          />
        </div>
      )}
    </div>
  );
};
