import { CatalogEntityType, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SelectOption, Spinner, Tabs } from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_CLASS } from '../../constants/public-class-names';
import { CatalogItem } from '../../models/catalog-item';
import type { CatalogProps } from '../../models/catalog-props';
import type { CatalogItemDetailsFetchResult } from '../../models/item-details-data';
import { CatalogSortKey } from '../../types/sort';
import type { CredentialsLevel } from '../../types/toolset-auth';
import { CatalogViewMode } from '../../types/view-mode';
import {
  filterByMyApp,
  filterByTopics,
  filterCatalogItems,
  getTopicOptions,
} from '../../utils/catalog-filter';
import { sortCatalogItems } from '../../utils/catalog-sort';
import { buildCatalogTabs } from '../../utils/catalog-tabs';
import { getStyles } from '../../utils/styles';
import { isLevelSignedIn, sleep } from '../../utils/toolset-credentials';
import { CardGrid } from '../CardGrid/CardGrid';
import { DetailsPanel } from '../Details/DetailsPanel';
import { Favorites } from '../Favorites/Favorites';
import { ListView } from '../ListView/ListView';
import { Toolbar } from '../Toolbar/Toolbar';
import styles from './Catalog.module.scss';
import { CreateButton } from './CreateButton';

/**
 * How many times the post-login/post-logout details refetch retries before
 * giving up, and the delay between attempts. A successful login/logout call
 * has already completed against DIAL Core by the time this runs, but DIAL
 * Core's own credential propagation (and, separately, this app's short-lived
 * details cache) can lag the write by a beat — so a single immediate refetch
 * occasionally still reports the pre-change status. Retrying briefly at this
 * layer is scoped to the auth-confirmation flow only; ordinary item selection
 * still does a single fetch for responsiveness.
 */
const POST_AUTH_REFRESH_ATTEMPTS = 3;
const POST_AUTH_REFRESH_DELAY_MS = 300;

/** Root catalog component: entity browsing with tabs, search, sort, filter, favorites strip, and details panel. */
export const Catalog: FC<CatalogProps> = ({
  items,
  tabs: controlledTabs,
  topicOptions: controlledTopicOptions,
  favorites,
  titles,
  browseHeaderRenderer,
  onToggleFavorite,
  isFavoriteVisible,
  columnVisibility,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  isPublishVisible,
  isPublishPrimary,
  getPublishHistory,
  publishFolderItems,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  hasPublishWriteAccess,
  publishDefaultAuthor,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onCreatePublishFolder,
  publishLabels,
  ruleSourceOptions,
  onFetchExistingRules,
  shareOverlay,
  isShareVisible,
  isSharePrimary,
  onFetchDetails,
  onEdit,
  onDownload,
  isDownloadVisible,
  isDownloadPrimary,
  onLoadContentFile,
  onLoadContentFilePreview,
  renderContentFilePreview,
  onDelete,
  onUnshare,
  isUnshareVisible,
  onRevokeShare,
  onFetchRecipientsCount,
  isRevokeShareVisible,
  onUnpublish,
  isUnpublishVisible,
  onLogin,
  onLogout,
  onCreateClick,
  createOptions,
  hideCreateButton = false,
  hidePageTitle = false,
  isReadonly = false,
  initialViewMode = CatalogViewMode.Grid,
  isFullWidth = false,
  selectedItemId,
  onCardClick,
  isLoading,
  styles: catalogStyles,
  detailsTexts,
  detailsLimitsFooterNote,
  initialDetailsItemId,
  sortKey: controlledSortKey,
  onSortChange,
  filterTopics: controlledFilterTopics,
  onFilterTopicsChange,
  isMyAppsActive: controlledIsMyAppsActive,
  onMyAppsActiveChange,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  renderEmptyState,
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
  const viewToggleLabel = titles?.viewToggleLabel ?? 'View mode';
  const resolvedAriaLabel = titles?.ariaLabel ?? 'Catalog';

  const sortLabel = titles?.sortLabel ?? 'Sort';

  const sortOptions: SelectOption[] = [
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
  const [viewMode, setViewMode] = useState<CatalogViewMode>(initialViewMode);
  const [listEverShown, setListEverShown] = useState(
    initialViewMode === CatalogViewMode.Cards,
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
    () => controlledTopicOptions ?? getTopicOptions(filteredItems),
    [controlledTopicOptions, filteredItems],
  );

  const tabs = useMemo(
    () => controlledTabs ?? buildCatalogTabs(filteredItems, titles?.tabLabels),
    [controlledTabs, filteredItems, titles?.tabLabels],
  );

  const firstTabId = tabs[0]?.id ?? '';
  const [internalActiveTab, setInternalActiveTab] = useState(firstTabId);

  useEffect(() => {
    setInternalActiveTab((prev) => prev || firstTabId);
  }, [firstTabId]);

  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleActiveTabChange = useCallback(
    (tabId: string) => {
      setInternalActiveTab(tabId);
      onActiveTabChange?.(tabId);
    },
    [onActiveTabChange],
  );

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
  /*
   * Identifies each in-flight `onFetchDetails` call by a monotonically
   * increasing token, so state is applied only while the captured token is
   * still current. `pendingItemIdRef` alone cannot tell two requests for the
   * *same* item apart: closing the panel clears it and reopening the same
   * item re-assigns the same id, so a still-pending earlier response would
   * pass an id-only guard and overwrite the newer request's result.
   */
  const pendingRequestIdRef = useRef(0);

  const fetchDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      pendingItemIdRef.current = item.id;
      const requestId = ++pendingRequestIdRef.current;

      if (!onFetchDetails) return undefined;

      setIsDetailsLoading(true);
      try {
        const details = await onFetchDetails(item);
        if (pendingRequestIdRef.current === requestId) {
          setFetchedDetails(details);
        }
        return details;
      } finally {
        if (pendingRequestIdRef.current === requestId) {
          setIsDetailsLoading(false);
        }
      }
    },
    [onFetchDetails],
  );

  const handleOpenDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      setSelectedItem(item);
      setFetchedDetails(undefined);
      return fetchDetails(item);
    },
    [fetchDetails],
  );

  /**
   * Re-fetches details for the item already open in the panel, retrying up
   * to `POST_AUTH_REFRESH_ATTEMPTS` times until `isExpectedState` reports
   * true, or leaving the last attempt's result once attempts run out.
   * Unlike `handleOpenDetails`, this never clears `fetchedDetails` between
   * attempts, so the panel keeps showing the previous (pre-action) snapshot
   * instead of flashing back to the unenriched base item on every retry.
   */
  const retryDetailsUntil = useCallback(
    async (
      item: CatalogItem,
      isExpectedState: (
        details: CatalogItemDetailsFetchResult | undefined,
      ) => boolean,
    ): Promise<void> => {
      for (let attempt = 0; attempt < POST_AUTH_REFRESH_ATTEMPTS; attempt++) {
        /* The user may close the panel (or open a different item) while a
         * login/logout call or an inter-attempt sleep is in flight —
         * `pendingItemIdRef` is cleared/reassigned synchronously by those
         * actions, so bail out rather than resurrecting a closed panel. */
        if (pendingItemIdRef.current !== item.id) return;
        const details = await fetchDetails(item);
        if (isExpectedState(details)) return;
        if (attempt < POST_AUTH_REFRESH_ATTEMPTS - 1) {
          await sleep(POST_AUTH_REFRESH_DELAY_MS);
        }
      }
    },
    [fetchDetails],
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
      if (!onFetchDetails) return;
      await retryDetailsUntil(item, (details) =>
        isLevelSignedIn(details?.credentials, params.level),
      );
    },
    [onLogin, onFetchDetails, retryDetailsUntil],
  );

  const handleLogout = useCallback(
    async (item: CatalogItem, params: { level: CredentialsLevel }) => {
      await onLogout?.(item, params);
      if (!onFetchDetails) return;
      await retryDetailsUntil(
        item,
        (details) => !isLevelSignedIn(details?.credentials, params.level),
      );
    },
    [onLogout, onFetchDetails, retryDetailsUntil],
  );

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    pendingItemIdRef.current = null;
    /* Invalidates the in-flight request's token, so a response arriving after close cannot resurrect the closed panel. */
    pendingRequestIdRef.current += 1;
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
    if (mode === CatalogViewMode.Cards) setListEverShown(true);
    setViewMode(mode);
  }, []);

  const isCreateButtonVisible = !hideCreateButton && !isReadonly;
  /* A read-only catalog cannot favorite anything, so the strip has no way to
   * gain or lose entries and is dropped rather than shown frozen. */
  const isFavoritesVisible = isFavoritesRendered && !isReadonly;

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

  /*
   * Built from the same resolved locals the rest of Catalog already renders
   * from, so the reported context is correct whether each value is managed
   * internally or externally controlled.
   */
  const isResultSetEmpty = !isLoading && tabFiltered.length === 0;
  const customEmptyState = isResultSetEmpty
    ? renderEmptyState?.({
        query,
        activeTab,
        hasTopicFilters: filters.size > 0,
        isMyAppsActive,
      })
    : undefined;

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
        CATALOG_CLASS.root,
        'flex size-full min-h-0 flex-1 flex-col',
        styles.root,
      )}
      style={cssVars}
    >
      {(!hidePageTitle || isCreateButtonVisible) && (
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
            {isCreateButtonVisible && (
              <CreateButton
                label={createLabel}
                options={createOptions}
                onClick={onCreateClick}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {isFavoritesVisible && (
          <div className="w-full px-8">
            <Favorites
              items={favorites}
              totalCount={favorites.length}
              title={favoritesTitle}
              onToggleFavorite={onToggleFavorite}
              isFavoriteVisible={isFavoriteVisible}
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
            browseHeaderRenderer={browseHeaderRenderer}
            searchPlaceholder={searchPlaceholder}
            gridViewLabel={gridViewLabel}
            listViewLabel={listViewLabel}
            viewToggleLabel={viewToggleLabel}
            sortOptions={sortOptions}
            onSortChange={handleSortChange}
            sortLabel={sortLabel}
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

        {/* A lone tab is not a choice — with nothing to switch to, the row is
            dropped rather than rendered as a single inert tab. `activeTab`
            still resolves to that one type, so the grid is unaffected. */}
        {tabs.length > 1 && (
          <div className="min-w-0 shrink-0 overflow-x-auto px-8">
            <Tabs
              tabs={tabs.map((tab) => ({
                id: tab.id,
                label:
                  typeof tab.label === 'string' ? tab.label : String(tab.label),
                count: myAppsFiltered.filter((item) => item.type === tab.id)
                  .length,
              }))}
              activeTabId={activeTab}
              onTabChange={handleActiveTabChange}
            />
          </div>
        )}
        <div
          className={mergeClasses(
            tabFiltered.length > 0
              ? [
                  'min-h-full w-full px-8 py-6',
                  /* Tailwind's JIT cannot scan a variable, so the cap is a
                     literal here and `CONTENT_MAX_WIDTH` in
                     `constants/virtual-grid.ts` — which the virtualizer reads
                     to guess the column count. Change both together. */
                  !isFullWidth && 'mx-auto max-w-[1180px]',
                ]
              : 'min-h-[180px] flex-1',
            tabFiltered.length === 0 && 'px-8 py-6',
          )}
        >
          {customEmptyState != null ? (
            customEmptyState
          ) : (
            <>
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
                  isFavoriteVisible={isFavoriteVisible}
                  onItemClick={onCardClick ?? handleOpenDetails}
                  titles={cardGridTitles}
                  selectedItemId={selectedItemId}
                  isReadonly={isReadonly}
                  isFullWidth={isFullWidth}
                  featuredChipStyle={catalogStyles?.colors?.featuredChipStyle}
                />
              </div>

              {listEverShown && (
                <div
                  className={mergeClasses(
                    'pb-8',
                    viewMode !== CatalogViewMode.Cards && 'hidden',
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
                    isFavoriteVisible={isFavoriteVisible}
                    columnVisibility={columnVisibility}
                    onItemClick={onCardClick ?? handleOpenDetails}
                    stickyHeaderTop={0}
                    selectedItemId={selectedItemId}
                    credentialsBadgeLoggedOutLabel={
                      detailsTexts?.credentialsBadgeLoggedOutLabel
                    }
                    isReadonly={isReadonly}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {detailsPanelItem != null && (
        <DetailsPanel
          item={detailsPanelItem}
          isOpen={isDetailsOpen}
          isStarred={isSelectedItemStarred}
          isDetailsLoading={isDetailsLoading}
          isReadonly={isReadonly}
          onClose={handleCloseDetails}
          onToggleFavorite={onToggleFavorite}
          isFavoriteVisible={isFavoriteVisible}
          onUseInChat={onUseInChat}
          isPrimaryActionVisible={isPrimaryActionVisible}
          onShare={onShare}
          isPublishVisible={isPublishVisible}
          isPublishPrimary={isPublishPrimary}
          getPublishHistory={getPublishHistory}
          publishFolderItems={publishFolderItems}
          publishExpandedPaths={publishExpandedPaths}
          onPublishExpandedPathsChange={onPublishExpandedPathsChange}
          publishLoadingPaths={publishLoadingPaths}
          hasPublishWriteAccess={hasPublishWriteAccess}
          publishDefaultAuthor={publishDefaultAuthor}
          onPublish={onPublish}
          onPublishSuccess={onPublishSuccess}
          onPublishError={onPublishError}
          onCreatePublishFolder={onCreatePublishFolder}
          publishLabels={publishLabels}
          ruleSourceOptions={ruleSourceOptions}
          onFetchExistingRules={onFetchExistingRules}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          isSharePrimary={isSharePrimary}
          onEdit={onEdit}
          onDownload={onDownload}
          isDownloadVisible={isDownloadVisible}
          isDownloadPrimary={isDownloadPrimary}
          onLoadContentFile={onLoadContentFile}
          onLoadContentFilePreview={onLoadContentFilePreview}
          renderContentFilePreview={renderContentFilePreview}
          onDelete={onDelete}
          onUnshare={onUnshare}
          isUnshareVisible={isUnshareVisible}
          onRevokeShare={onRevokeShare}
          onFetchRecipientsCount={onFetchRecipientsCount}
          isRevokeShareVisible={isRevokeShareVisible}
          onUnpublish={onUnpublish}
          isUnpublishVisible={isUnpublishVisible}
          onLogin={handleLogin}
          onLogout={handleLogout}
          texts={detailsTexts}
          limitsFooterNote={detailsLimitsFooterNote}
          styles={{
            colors: {
              featuredChipStyle: catalogStyles?.colors?.featuredChipStyle,
            },
          }}
        />
      )}
    </section>
  );
};
