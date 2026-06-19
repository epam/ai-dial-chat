import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialPrimaryButton,
  DialTabs,
  type TabModel,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { FC, useCallback, useRef, useState } from 'react';
import { TabLabel } from '../../components/TabLabel/TabLabel';
import {
  DEFAULT_DOMAIN_OPTIONS,
  DEFAULT_MATURITY_OPTIONS,
  DEFAULT_SORT_OPTIONS,
  DEFAULT_USE_CASE_OPTIONS,
} from '../../constants/catalog-defaults';
import {
  DEFAULT_ALL_FROM_IDS,
  DEFAULT_FROM_TREE,
} from '../../constants/from-tree';
import type { CatalogItem } from '../../models/CatalogItem';
import type { CatalogProps } from '../../models/CatalogProps';
import { CatalogSortKey } from '../../types/CatalogSortKey';
import { CatalogViewMode } from '../../types/CatalogViewMode';
import { filterCatalogItems } from '../../utils/catalog-filter';
import { sortCatalogItems } from '../../utils/catalog-sort';
import { CatalogBrowseToolbar } from '../CatalogBrowseToolbar/CatalogBrowseToolbar';
import { CatalogCardGrid } from '../CatalogCardGrid/CatalogCardGrid';
import { CatalogFavorites } from '../CatalogFavorites/CatalogFavorites';
import { CatalogItemDetails } from '../CatalogItemDetails/CatalogItemDetails';
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
  texts,
  onToggleFavorite,
  onUseInChat,
  onShare,
  onFetchAboutContent,
  onCreateClick,
  tabs = [],
  sortOptions = DEFAULT_SORT_OPTIONS,
  maturityOptions = DEFAULT_MATURITY_OPTIONS,
  useCaseOptions = DEFAULT_USE_CASE_OPTIONS,
  domainOptions = DEFAULT_DOMAIN_OPTIONS,
  fromTree = DEFAULT_FROM_TREE,
  allFromIds = DEFAULT_ALL_FROM_IDS,
  noResultsTitle = (q) => `No results for "${q}"`,
  styles: catalogStyles,
}) => {
  const { colors, typography } = catalogStyles ?? {};

  const hasPageHeadingClass = Boolean(typography?.pageHeadingFontClassName);
  const cssVars = buildCssVars({
    '--cat-bg': colors?.background,
    '--cat-text-primary': colors?.text,
    '--cat-text-secondary': colors?.textSecondary,
    '--cat-heading-border': colors?.headingBorder,
    '--cat-heading-bg': colors?.headingBackground,
    '--cat-heading-title-text': colors?.headingTitleText,
    '--cat-content-bg': colors?.contentBackground,
    '--cat-section-heading-text': colors?.sectionHeadingText,
    '--cat-no-results-title-text': colors?.noResultsTitleText,
    '--cat-no-results-description-text': colors?.noResultsDescriptionText,
    '--cat-page-heading-font-family': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontFamily,
    '--cat-page-heading-font-size': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontSize,
    '--cat-page-heading-font-weight': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingFontWeight?.toString(),
    '--cat-page-heading-line-height': hasPageHeadingClass
      ? undefined
      : typography?.pageHeadingLineHeight,
  });

  const pageTitle = texts?.pageTitle ?? 'Catalog';
  const createLabel = texts?.createLabel ?? 'Create';
  const favoritesTitle = texts?.favoritesTitle ?? 'Your Favorites';
  const browseTitle = texts?.browseTitle ?? 'Browse';
  const searchPlaceholder =
    texts?.searchPlaceholder ?? 'Search models, tools, agents…';
  const noResultsDescription =
    texts?.noResultsDescription ?? 'Try a different keyword';
  const resolvedAriaLabel = texts?.ariaLabel ?? 'Catalog';

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<CatalogViewMode>(
    CatalogViewMode.Grid,
  );
  const [listEverShown, setListEverShown] = useState(false);
  const [sortKey, setSortKey] = useState<string>(
    CatalogSortKey.RecentlyUpdated,
  );
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
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

  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [aboutContent, setAboutContent] = useState<string | undefined>(
    undefined,
  );
  const [isAboutLoading, setIsAboutLoading] = useState(false);
  const pendingItemIdRef = useRef<string | null>(null);

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

  const handleOpenDetails = useCallback(
    async (item: CatalogItem) => {
      setSelectedItem(item);
      setIsDetailsOpen(true);
      setAboutContent(undefined);

      if (onFetchAboutContent) {
        setIsAboutLoading(true);
        pendingItemIdRef.current = item.id;
        try {
          const content = await onFetchAboutContent(item);
          if (pendingItemIdRef.current === item.id) {
            setAboutContent(content);
          }
        } finally {
          if (pendingItemIdRef.current === item.id) {
            setIsAboutLoading(false);
          }
        }
      }
    },
    [onFetchAboutContent],
  );

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    pendingItemIdRef.current = null;
    setTimeout(() => {
      setSelectedItem(null);
      setAboutContent(undefined);
      setIsAboutLoading(false);
    }, 300);
  }, []);

  const sorted = sortCatalogItems(items, sortKey);
  const filtered = filterCatalogItems(sorted, {
    fromChecked,
    allFromIds,
    domainSelected,
    useCaseSelected,
    maturitySelected,
    query,
  });
  const tabFiltered = activeTab
    ? filtered.filter((item) => item.type === activeTab)
    : filtered;

  const tabsWithCounts: TabModel[] = tabs.map((tab) => ({
    ...tab,
    label: (
      <TabLabel
        text={typeof tab.label === 'string' ? tab.label : String(tab.label)}
        count={filtered.filter((item) => item.type === tab.id).length}
        countClassName={styles.tabCount}
      />
    ),
  }));

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
      className={mergeClasses(
        'flex min-h-0 flex-1 flex-col overflow-auto',
        styles.root,
      )}
      style={cssVars}
    >
      {/* Page heading */}
      <div
        className={mergeClasses(
          'flex h-16 shrink-0 items-center justify-between border-b px-6',
          styles.heading,
        )}
      >
        <h2
          className={mergeClasses(
            typography?.pageHeadingFontClassName ?? 'dial-h2-text',
            styles.headingTitle,
          )}
        >
          {pageTitle}
        </h2>
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

      {/* Browse toolbar */}
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
        title={browseTitle}
        searchPlaceholder={searchPlaceholder}
        sortOptions={sortOptions}
      />

      {/* Entity-type tabs — sticky as the page scrolls */}
      {tabs.length > 0 && (
        <div
          className={mergeClasses(
            'sticky top-0 z-10 shrink-0 border-b [&>div]:justify-center',
            styles.stickyTabsRow,
          )}
        >
          <DialTabs
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>
      )}

      {/* Grid view */}
      {viewMode === CatalogViewMode.Grid && (
        <div className={styles.gridView}>
          <CatalogCardGrid
            items={tabFiltered}
            query={query}
            onToggleFavorite={onToggleFavorite}
            onItemClick={handleOpenDetails}
            titles={{
              noResultsTitle: emptyTitle,
              noResultsDescription: emptyDesc,
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
        <div className={styles.listView}>
          <CatalogListView
            items={tabFiltered}
            query={query}
            ariaLabel={resolvedAriaLabel}
            emptyStateTitle={emptyTitle}
            emptyStateDescription={emptyDesc}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      )}

      {/* Details panel */}
      {selectedItem != null && (
        <CatalogItemDetails
          item={selectedItem}
          isOpen={isDetailsOpen}
          aboutContent={aboutContent}
          isAboutLoading={isAboutLoading}
          onClose={handleCloseDetails}
          onToggleFavorite={onToggleFavorite}
          onUseInChat={onUseInChat}
          onShare={onShare}
        />
      )}
    </div>
  );
};
