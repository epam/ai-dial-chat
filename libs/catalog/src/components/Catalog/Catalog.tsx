import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSpinner, DialTabs, TabModel } from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import type { CatalogProps } from '../../models/catalog-props';
import { CatalogSortKey } from '../../types/sort';
import { CatalogViewMode } from '../../types/view-mode';
import { filterCatalogItems } from '../../utils/catalog-filter';
import { sortCatalogItems } from '../../utils/catalog-sort';
import { buildCatalogTabs } from '../../utils/catalog-tabs';
import { getStyles } from '../../utils/styles';
import { CardGrid } from '../CardGrid/CardGrid';
import { DetailsPanel } from '../Details/DetailsPanel';
import { Favorites } from '../Favorites/Favorites';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import { ListView } from '../ListView/ListView';
import { Toolbar } from '../Toolbar/Toolbar';
import styles from './Catalog.module.scss';
import { CreateButton } from './CreateButton';

/**
 * Root catalog component. Owns all filter/sort/pagination state and wires
 * CatalogFavorites, Toolbar, CatalogCardGrid, and CatalogListView.
 * Consumers provide data via props; no direct API or context access.
 */
export const Catalog: FC<CatalogProps> = ({
  items,
  favorites,
  titles,
  onToggleFavorite,
  onUseInChat,
  onShare,
  onFetchAboutContent,
  onCreateClick,
  createOptions,
  isLoading,
  styles: catalogStyles,
  detailsTexts,
}) => {
  const { typography } = catalogStyles ?? {};

  const cssVars = getStyles(catalogStyles);

  const pageTitle = titles?.pageTitle ?? 'Catalog';
  const createLabel = titles?.createLabel ?? 'Create';
  const favoritesTitle = titles?.favoritesTitle ?? 'Your Favorites';
  const browseTitle = titles?.browseTitle ?? 'Browse';
  const searchPlaceholder =
    titles?.searchPlaceholder ?? 'Search models, tools, agents…';
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
  const filteredItems = items.filter((item) => !item.isHidden);

  const [query, setQuery] = useState('');

  const [viewMode, setViewMode] = useState<CatalogViewMode>(
    CatalogViewMode.Grid,
  );
  const [listEverShown, setListEverShown] = useState(false);
  const [sortKey, setSortKey] = useState<string>(
    CatalogSortKey.RecentlyUpdated,
  );
  const tabs = buildCatalogTabs(filteredItems, titles?.tabLabels);
  const firstTabId = tabs[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState(firstTabId);

  useEffect(() => {
    setActiveTab((prev) => prev || firstTabId);
  }, [firstTabId]);

  const [isFavoritesRendered, setIsFavoritesRendered] = useState(
    favorites.length > 0,
  );

  // When favorites reappear after being fully removed, remount the section.
  useEffect(() => {
    if (favorites.length > 0 && !isFavoritesRendered) {
      setIsFavoritesRendered(true);
    }
  }, [favorites.length, isFavoritesRendered]);

  const handleFavoritesExitComplete = useCallback(() => {
    setIsFavoritesRendered(false);
  }, []);

  const isFavoritesLeaving = isFavoritesRendered && favorites.length === 0;

  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [aboutContent, setAboutContent] = useState<string | undefined>(
    undefined,
  );
  const [isAboutLoading, setIsAboutLoading] = useState(false);
  const pendingItemIdRef = useRef<string | null>(null);

  // TODO: check details
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

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <DialSpinner />
      </div>
    );
  }

  const handleViewModeChange = (mode: CatalogViewMode) => {
    if (mode === CatalogViewMode.List) setListEverShown(true);
    setViewMode(mode);
  };

  const clearAllFilters = () => {
    // TODO: implement when filters are added
  };

  const sorted = sortCatalogItems(filteredItems, sortKey);
  const filtered = filterCatalogItems(sorted, query);

  const tabFiltered = activeTab
    ? filtered.filter((item) => item.type === activeTab)
    : filtered;

  const tabsWithCounts: TabModel[] = tabs.map((tab) => ({
    ...tab,
    label: (
      <ItemHeader
        title={typeof tab.label === 'string' ? tab.label : String(tab.label)}
        titleClassName={typography?.tabClassName ?? 'dial-body-text'}
        postfix={filtered.filter((item) => item.type === tab.id).length}
      />
    ),
  }));

  // TODO: determine if any filter is active (for now we have no filters, so this is always false)
  const isAnyFilterActive = false;

  const emptyTitle = query ? noResultsTitle(query) : 'No items';

  return (
    <section
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
        <h1
          className={mergeClasses(
            typography?.pageHeadingFontClassName ?? 'dial-h1-text',
            styles.headingTitle,
          )}
        >
          {pageTitle}
        </h1>
        <CreateButton
          label={createLabel}
          options={createOptions}
          onClick={onCreateClick}
        />
      </div>

      {/* Favorites strip — kept in DOM during exit animation then unmounted */}
      {isFavoritesRendered && (
        <Favorites
          items={favorites}
          totalCount={favorites.length}
          title={favoritesTitle}
          onToggleFavorite={onToggleFavorite}
          onItemClick={handleOpenDetails}
          isLeaving={isFavoritesLeaving}
          onExitComplete={handleFavoritesExitComplete}
        />
      )}

      {/* Browse toolbar (title, view toggle, sort, search, filters, tabs) */}
      <Toolbar
        totalCount={filteredItems.length}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        sortKey={sortKey}
        onSortChange={setSortKey}
        query={query}
        onQueryChange={setQuery}
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
            'sticky top-0 z-10 mb-2 flex shrink-0 justify-center border-b pt-2',
            styles.stickyTabsRow,
          )}
        >
          <DialTabs
            className="justify-center"
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>
      )}

      {/* Grid view */}
      {viewMode === CatalogViewMode.Grid && (
        <div className={mergeClasses('min-h-0 flex-1 pb-5', styles.gridView)}>
          <CardGrid
            items={tabFiltered}
            query={query}
            onToggleFavorite={onToggleFavorite}
            onItemClick={handleOpenDetails}
            titles={{
              noResultsTitle: emptyTitle,
              featuredLabel,
            }}
          />
        </div>
      )}

      {/* List view — mounted only after first shown to avoid initializing ag-grid eagerly */}
      {listEverShown && viewMode === CatalogViewMode.List && (
        <div className={mergeClasses('min-h-0 flex-1 pb-5', styles.listView)}>
          <ListView
            items={tabFiltered}
            query={query}
            ariaLabel={resolvedAriaLabel}
            emptyStateTitle={emptyTitle}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      )}

      {/* Details panel */}
      {selectedItem != null && (
        <DetailsPanel
          item={selectedItem}
          isOpen={isDetailsOpen}
          aboutContent={aboutContent}
          isAboutLoading={isAboutLoading}
          onClose={handleCloseDetails}
          onToggleFavorite={onToggleFavorite}
          onUseInChat={onUseInChat}
          onShare={onShare}
          texts={detailsTexts}
        />
      )}
    </section>
  );
};
