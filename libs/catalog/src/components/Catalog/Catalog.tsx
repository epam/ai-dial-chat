import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { TabRow } from '@epam/ai-dial-kit';
import { Spinner, DropdownItem } from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import type { CatalogProps } from '../../models/catalog-props';
import type { CatalogItemDetailsFetchResult } from '../../models/item-details-data';
import { CatalogEntityType } from '../../types/entity-type';
import { CatalogSortKey } from '../../types/sort';
import type { CredentialsLevel } from '../../types/toolset-auth';
import { CatalogViewMode } from '../../types/view-mode';
import {
  filterByMyApp,
  filterByTopics,
  filterCatalogItems,
} from '../../utils/catalog-filter';
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

/** Root catalog component: entity browsing with tabs, search, sort, filter, favorites strip, and details panel. */
export const Catalog: FC<CatalogProps> = ({
  items,
  favorites,
  titles,
  onToggleFavorite,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  isPublishVisible,
  getPublishHistory,
  publishFolderItems,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  hasPublishWriteAccess,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onCreatePublishFolder,
  publishLabels,
  ruleSourceOptions,
  onFetchExistingRules,
  shareOverlay,
  isShareVisible,
  onFetchDetails,
  onEdit,
  onDelete,
  onUnshare,
  onRevokeShare,
  onLogin,
  onLogout,
  onCreateClick,
  createOptions,
  hideCreateButton = false,
  hidePageTitle = false,
  initialViewMode = CatalogViewMode.Grid,
  selectedItemId,
  onCardClick,
  isLoading,
  styles: catalogStyles,
  detailsTexts,
  initialDetailsItemId,
  sortKey: controlledSortKey,
  onSortChange,
  filterTopics: controlledFilterTopics,
  onFilterTopicsChange,
  isMyAppsActive: controlledIsMyAppsActive,
  onMyAppsActiveChange,
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
  const gridViewLabel = titles?.gridViewLabel ?? 'Grid view';
  const listViewLabel = titles?.listViewLabel ?? 'List view';
  const resolvedAriaLabel = titles?.ariaLabel ?? 'Catalog';

  const sortOptions: DropdownItem[] = [
    {
      key: CatalogSortKey.RecentlyUpdated,
      label: titles?.sortRecentlyUpdatedLabel ?? 'Recently Updated',
      onClick: () => handleSortChange?.(CatalogSortKey.RecentlyUpdated),
    },
    {
      key: CatalogSortKey.Newest,
      label: titles?.sortNewestLabel ?? 'Newest',
      onClick: () => handleSortChange?.(CatalogSortKey.Newest),
    },
    {
      key: CatalogSortKey.NameAZ,
      label: titles?.sortNameAZLabel ?? 'Name A-Z',
      onClick: () => handleSortChange?.(CatalogSortKey.NameAZ),
    },
  ];

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<CatalogViewMode>(initialViewMode);
  const [listEverShown, setListEverShown] = useState(
    initialViewMode === CatalogViewMode.List,
  );
  const [internalSortKey, setInternalSortKey] = useState<CatalogSortKey>(
    CatalogSortKey.RecentlyUpdated,
  );
  const [internalFilters, setInternalFilters] = useState<Set<string>>(
    new Set(),
  );
  const [internalIsMyAppsActive, setInternalIsMyAppsActive] = useState(false);

  const sortKey = controlledSortKey ?? internalSortKey;
  const filters = controlledFilterTopics ?? internalFilters;
  const isMyAppsActive = controlledIsMyAppsActive ?? internalIsMyAppsActive;

  const handleSortChange = useCallback(
    (key: string) => {
      const nextSortKey = key as CatalogSortKey;
      setInternalSortKey(nextSortKey);
      onSortChange?.(nextSortKey);
    },
    [onSortChange],
  );

  const handleFiltersChange = useCallback(
    (topics: Set<string>) => {
      setInternalFilters(topics);
      onFilterTopicsChange?.(topics);
    },
    [onFilterTopicsChange],
  );

  const handleMyAppsActiveChange = useCallback(
    (isActive: boolean) => {
      setInternalIsMyAppsActive(isActive);
      onMyAppsActiveChange?.(isActive);
    },
    [onMyAppsActiveChange],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => !item.isHidden),
    [items],
  );

  const allFilterValues = useMemo(
    () => new Set(filteredItems.flatMap((item) => item.topics)),
    [filteredItems],
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
  const [fetchedDetails, setFetchedDetails] = useState<
    CatalogItemDetailsFetchResult | undefined
  >(undefined);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const pendingItemIdRef = useRef<string | null>(null);

  const handleOpenDetails = useCallback(
    async (item: CatalogItem) => {
      setSelectedItem(item);
      setFetchedDetails(undefined);
      pendingItemIdRef.current = item.id;

      const fetches: Promise<void>[] = [];

      if (onFetchDetails) {
        setIsDetailsLoading(true);
        fetches.push(
          (async () => {
            try {
              const details = await onFetchDetails(item);
              if (pendingItemIdRef.current === item.id) {
                setFetchedDetails(details);
              }
            } finally {
              if (pendingItemIdRef.current === item.id) {
                setIsDetailsLoading(false);
              }
            }
          })(),
        );
      }

      await Promise.all(fetches);
    },
    [onFetchDetails],
  );

  const appliedInitialDetailsItemIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialDetailsItemId) {
      appliedInitialDetailsItemIdRef.current = null;
      return;
    }
    if (appliedInitialDetailsItemIdRef.current === initialDetailsItemId) {
      return;
    }
    const item = items.find(
      (catalogItem) => catalogItem.id === initialDetailsItemId,
    );
    if (!item) return;
    appliedInitialDetailsItemIdRef.current = initialDetailsItemId;
    void handleOpenDetails(item);
  }, [initialDetailsItemId, items, handleOpenDetails]);

  /*
   * Keeps the open details panel in sync with later corrections to `items`
   * (e.g. share-invitation resolution upgrading isMy/canEdit/sharedWithMe
   * from the owner-context placeholder to the real shared-context values).
   * Without this, selectedItem stays frozen on whatever snapshot was current
   * when the panel first opened, so the Edit button and bucket label never
   * update until the page is refreshed.
   */
  useEffect(() => {
    if (selectedItem == null) return;
    const updated = items.find(
      (catalogItem) => catalogItem.id === selectedItem.id,
    );
    if (updated && updated !== selectedItem) {
      setSelectedItem(updated);
    }
  }, [items, selectedItem]);

  const handleLogin = useCallback(
    async (
      item: CatalogItem,
      params: { level: CredentialsLevel; apiKey?: string },
    ) => {
      await onLogin?.(item, params);
      await handleOpenDetails(item);
    },
    [onLogin, handleOpenDetails],
  );

  const handleLogout = useCallback(
    async (item: CatalogItem, params: { level: CredentialsLevel }) => {
      await onLogout?.(item, params);
      await handleOpenDetails(item);
    },
    [onLogout, handleOpenDetails],
  );

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    pendingItemIdRef.current = null;
    setTimeout(() => {
      setSelectedItem(null);
      setFetchedDetails(undefined);
      setIsDetailsLoading(false);
    }, 300);
  }, []);

  const detailsPanelItem = useMemo<CatalogItem | null>(() => {
    if (selectedItem == null) return null;
    if (fetchedDetails == null) return selectedItem;
    const { credentials, ...tabData } = fetchedDetails;
    return {
      ...selectedItem,
      details: tabData,
      credentials: credentials ?? selectedItem.credentials,
    };
  }, [selectedItem, fetchedDetails]);

  const sorted = useMemo(
    () => sortCatalogItems(filteredItems, sortKey),
    [filteredItems, sortKey],
  );

  const filtered = useMemo(
    () => filterCatalogItems(sorted, query),
    [sorted, query],
  );

  const topicFiltered = useMemo(
    () => (filters.size > 0 ? filterByTopics(filtered, filters) : filtered),
    [filtered, filters],
  );

  const myAppsFiltered = useMemo(
    () => (isMyAppsActive ? filterByMyApp(topicFiltered) : topicFiltered),
    [topicFiltered, isMyAppsActive],
  );

  const tabFiltered = useMemo(
    () =>
      activeTab
        ? myAppsFiltered.filter((item) => item.type === activeTab)
        : myAppsFiltered,
    [myAppsFiltered, activeTab],
  );

  const isSelectedItemStarred =
    selectedItem != null && favorites.some((f) => f.id === selectedItem.id);

  useEffect(() => {
    if (selectedItem == null) return;
    const rafId = requestAnimationFrame(() => setIsDetailsOpen(true));
    return () => cancelAnimationFrame(rafId);
  }, [selectedItem]);

  const handleViewModeChange = useCallback((mode: CatalogViewMode) => {
    if (mode === CatalogViewMode.List) setListEverShown(true);
    setViewMode(mode);
  }, []);

  const emptyTitle = query ? noResultsTitle(query) : 'No items';
  const cardGridTitles = useMemo(
    () => ({
      noResultsTitle: emptyTitle,
      featuredLabel,
      credentialsBadgeLoggedOutLabel:
        detailsTexts?.credentialsBadgeLoggedOutLabel,
    }),
    [emptyTitle, featuredLabel, detailsTexts?.credentialsBadgeLoggedOutLabel],
  );

  if (isLoading) {
    return (
      <div className="flex size-full min-h-0 flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <section
      aria-label={resolvedAriaLabel}
      className={mergeClasses(
        'flex size-full min-h-0 flex-1 flex-col',
        styles.root,
      )}
      style={cssVars}
    >
      {(!hidePageTitle || !hideCreateButton) && (
        <div className={mergeClasses('shrink-0', styles.heading)}>
          <div className="flex h-[64px] w-full items-center justify-between px-8">
            {!hidePageTitle && (
              <h1
                className={mergeClasses(
                  typography?.pageHeadingFontClassName ?? 'dial-display2-text',
                  styles.headingTitle,
                )}
              >
                {pageTitle}
              </h1>
            )}
            {!hideCreateButton && (
              <CreateButton
                label={createLabel}
                options={createOptions}
                onClick={onCreateClick}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {isFavoritesRendered && (
          <div className="w-full px-8">
            <Favorites
              items={favorites}
              totalCount={favorites.length}
              title={favoritesTitle}
              onToggleFavorite={onToggleFavorite}
              onItemClick={onCardClick ?? handleOpenDetails}
              isLeaving={isFavoritesLeaving}
              onExitComplete={handleFavoritesExitComplete}
              selectedItemId={selectedItemId}
              credentialsBadgeLoggedOutLabel={
                detailsTexts?.credentialsBadgeLoggedOutLabel
              }
            />
          </div>
        )}

        <div className="w-full px-4 pt-6">
          <Toolbar
            totalCount={myAppsFiltered.length}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sortKey={sortKey}
            query={query}
            onQueryChange={setQuery}
            title={browseTitle}
            searchPlaceholder={searchPlaceholder}
            gridViewLabel={gridViewLabel}
            listViewLabel={listViewLabel}
            sortOptions={sortOptions}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterValues={allFilterValues}
            isMyAppsActive={isMyAppsActive}
            onMyAppsChange={handleMyAppsActiveChange}
            filterFromLabel={titles?.filterFromLabel}
            filterMyAppsLabel={titles?.filterMyAppsLabel}
            filterTopicsLabel={titles?.filterTopicsLabel}
          />
        </div>

        {tabs.length > 0 && (
          <div className="px-8">
            <TabRow
              tabs={tabs.map((tab) => ({
                id: tab.id,
                label:
                  typeof tab.label === 'string' ? tab.label : String(tab.label),
                count: myAppsFiltered.filter((item) => item.type === tab.id)
                  .length,
              }))}
              activeTabId={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        )}
        <div
          className={mergeClasses(
            tabFiltered.length > 0
              ? 'mx-auto min-h-full w-full max-w-[1180px] px-8 py-6'
              : 'min-h-[180px] flex-1',
            tabFiltered.length === 0 && 'px-8 py-6',
          )}
        >
          <div
            className={mergeClasses(
              tabFiltered.length > 0 ? 'pb-8' : 'size-full flex-1',
              viewMode !== CatalogViewMode.Grid && 'hidden',
            )}
          >
            <CardGrid
              items={tabFiltered}
              query={query}
              onToggleFavorite={onToggleFavorite}
              onItemClick={onCardClick ?? handleOpenDetails}
              titles={cardGridTitles}
              selectedItemId={selectedItemId}
            />
          </div>

          {listEverShown && (
            <div
              className={mergeClasses(
                'pb-8',
                viewMode !== CatalogViewMode.List && 'hidden',
                tabFiltered.length === 0 && 'h-full',
              )}
            >
              <ListView
                type={activeTab as CatalogEntityType}
                items={tabFiltered}
                query={query}
                ariaLabel={resolvedAriaLabel}
                emptyStateTitle={emptyTitle}
                onToggleFavorite={onToggleFavorite}
                onItemClick={onCardClick ?? handleOpenDetails}
                stickyHeaderTop={0}
                selectedItemId={selectedItemId}
                credentialsBadgeLoggedOutLabel={
                  detailsTexts?.credentialsBadgeLoggedOutLabel
                }
              />
            </div>
          )}
        </div>
      </div>

      {detailsPanelItem != null && (
        <DetailsPanel
          item={detailsPanelItem}
          isOpen={isDetailsOpen}
          isStarred={isSelectedItemStarred}
          isDetailsLoading={isDetailsLoading}
          onClose={handleCloseDetails}
          onToggleFavorite={onToggleFavorite}
          onUseInChat={onUseInChat}
          isPrimaryActionVisible={isPrimaryActionVisible}
          onShare={onShare}
          isPublishVisible={isPublishVisible}
          getPublishHistory={getPublishHistory}
          publishFolderItems={publishFolderItems}
          publishExpandedPaths={publishExpandedPaths}
          onPublishExpandedPathsChange={onPublishExpandedPathsChange}
          publishLoadingPaths={publishLoadingPaths}
          hasPublishWriteAccess={hasPublishWriteAccess}
          onPublish={onPublish}
          onPublishSuccess={onPublishSuccess}
          onPublishError={onPublishError}
          onCreatePublishFolder={onCreatePublishFolder}
          publishLabels={publishLabels}
          ruleSourceOptions={ruleSourceOptions}
          onFetchExistingRules={onFetchExistingRules}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          onEdit={onEdit}
          onDelete={onDelete}
          onUnshare={onUnshare}
          onRevokeShare={onRevokeShare}
          onLogin={handleLogin}
          onLogout={handleLogout}
          texts={detailsTexts}
        />
      )}
    </section>
  );
};
