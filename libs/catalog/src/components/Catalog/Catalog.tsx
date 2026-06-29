import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSpinner } from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ListView } from '../ListView/ListView';
import { Toolbar } from '../Toolbar/Toolbar';
import styles from './Catalog.module.scss';
import { CreateButton } from './CreateButton';

/**
 * Root catalog component. Owns all filter/sort/tab/pagination state and wires
 * Favorites, Toolbar, CardGrid, and ListView.
 * All data arrives via props — no direct API or context access.
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
  const favoritesTitle = titles?.favoritesTitle ?? 'Your favorites';
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

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<CatalogViewMode>(
    CatalogViewMode.Grid,
  );
  const [listEverShown, setListEverShown] = useState(false);
  const [sortKey, setSortKey] = useState<string>(
    CatalogSortKey.RecentlyUpdated,
  );

  const filteredItems = useMemo(
    () => items.filter((item) => !item.isHidden),
    [items],
  );

  const tabs = useMemo(
    () => buildCatalogTabs(filteredItems, titles?.tabLabels),
    [filteredItems, titles?.tabLabels],
  );

  const firstTabId = tabs[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState(firstTabId);

  useEffect(() => {
    setActiveTab((prev) => prev || firstTabId);
  }, [firstTabId]);

  const [isFavoritesRendered, setIsFavoritesRendered] = useState(
    favorites.length > 0,
  );

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

  const handleOpenDetails = useCallback(
    async (item: CatalogItem) => {
      setSelectedItem(item);
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

  const sorted = useMemo(
    () => sortCatalogItems(filteredItems, sortKey),
    [filteredItems, sortKey],
  );

  const filtered = useMemo(
    () => filterCatalogItems(sorted, query),
    [sorted, query],
  );

  const tabFiltered = useMemo(
    () =>
      activeTab ? filtered.filter((item) => item.type === activeTab) : filtered,
    [filtered, activeTab],
  );

  const isSelectedItemStarred =
    selectedItem != null && favorites.some((f) => f.id === selectedItem.id);

  useEffect(() => {
    if (selectedItem == null) return;
    const rafId = requestAnimationFrame(() => setIsDetailsOpen(true));
    return () => cancelAnimationFrame(rafId);
  }, [selectedItem]);

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

  const isAnyFilterActive = false;
  const emptyTitle = query ? noResultsTitle(query) : 'No items';

  return (
    <section
      aria-label={resolvedAriaLabel}
      className={mergeClasses('flex min-h-0 flex-1 flex-col', styles.root)}
      style={cssVars}
    >
      {/* ── Sticky page heading ─────────────────────────────────── */}
      <div className={mergeClasses('shrink-0', styles.heading)}>
        <div className="flex h-[64px] w-full items-center justify-between px-8">
          <h1
            className={mergeClasses(
              typography?.pageHeadingFontClassName ?? 'dial-display2-text',
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
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* ── Favorites strip — full viewport width ─────────────── */}
        {isFavoritesRendered && (
          <div className="w-full px-8">
            <Favorites
              items={favorites}
              totalCount={favorites.length}
              title={favoritesTitle}
              onToggleFavorite={onToggleFavorite}
              onItemClick={handleOpenDetails}
              isLeaving={isFavoritesLeaving}
              onExitComplete={handleFavoritesExitComplete}
            />
          </div>
        )}

        {/* ── Browse toolbar — full width (outer px-4 + inner px-4 = 32px from edge) */}
        <div className="w-full px-4 pt-6">
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
        </div>

        {/* ── Entity-type tabs — full width */}
        {tabs.length > 0 && (
          <div className="px-8">
            <div
              className={mergeClasses(
                'flex justify-start gap-1 border-b',
                styles.tabsRow,
              )}
            >
              {tabs.map((tab) => {
                const count = filtered.filter(
                  (item) => item.type === tab.id,
                ).length;
                const isActive = activeTab === tab.id;
                const label =
                  typeof tab.label === 'string' ? tab.label : String(tab.label);
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={mergeClasses(
                      'dial-small-semi-text -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors',
                      isActive
                        ? mergeClasses(styles.activeTab, 'text-[#111827]')
                        : 'border-transparent text-[#6B7280] hover:text-[#374151]',
                    )}
                  >
                    <span>{label}</span>
                    <span
                      className={mergeClasses(
                        'dial-tiny-semi-text rounded-full px-1.5 py-0.5',
                        isActive
                          ? 'bg-[#EEF2FF] text-[#2764D9]'
                          : 'bg-[#F3F4F6] text-[#9CA3AF]',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Card / list grid — centred max-width column */}
        <div className="mx-auto w-full max-w-[1180px] px-8 pt-6">
          {/* Grid view */}
          {viewMode === CatalogViewMode.Grid && (
            <div className="pb-8">
              <CardGrid
                items={tabFiltered}
                query={query}
                onToggleFavorite={onToggleFavorite}
                onItemClick={handleOpenDetails}
                titles={{ noResultsTitle: emptyTitle, featuredLabel }}
              />
            </div>
          )}

          {/* List view — lazy-mounted */}
          {listEverShown && viewMode === CatalogViewMode.List && (
            <div className="pb-8">
              <ListView
                items={tabFiltered}
                query={query}
                ariaLabel={resolvedAriaLabel}
                emptyStateTitle={emptyTitle}
                onToggleFavorite={onToggleFavorite}
                onItemClick={handleOpenDetails}
                stickyHeaderTop={0}
              />
            </div>
          )}
        </div>
      </div>
      {/* end scrollable body */}

      {/* Details panel */}
      {selectedItem != null && (
        <DetailsPanel
          item={selectedItem}
          isOpen={isDetailsOpen}
          isStarred={isSelectedItemStarred}
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
