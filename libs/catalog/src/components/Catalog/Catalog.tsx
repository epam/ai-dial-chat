<<<<<<< HEAD
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialPrimaryButton,
  DialSpinner,
  TabModel,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { CatalogProps } from '../../models/catalog-props';
import { CatalogSortKey } from '../../types/sort';
import { CatalogViewMode } from '../../types/view-mode';
import { filterCatalogItems } from '../../utils/catalog-filter';
import { sortCatalogItems } from '../../utils/catalog-sort';
import { getStyles } from '../../utils/styles';
import { CardGrid } from '../CardGrid/CardGrid';
import { Favorites } from '../Favorites/Favorites';
import { ListView } from '../ListView/ListView';
import { Toolbar } from '../Toolbar/Toolbar';
=======
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
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e
import styles from './Catalog.module.scss';

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
  isLoading,
  styles: catalogStyles,
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
  const tabs = [] as TabModel[]; // TODO: implement tabs and remove this placeholder
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <DialSpinner size={44} />
      </div>
    );
  }

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
    // TODO: implement when filters are added
  };

<<<<<<< HEAD
  const sorted = sortCatalogItems(filteredItems, sortKey);
  const filtered = filterCatalogItems(sorted, query);
=======
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
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e

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
<<<<<<< HEAD
          'flex h-16 flex-shrink-0 items-center justify-between border-b px-6 py-3',
=======
          'flex h-16 shrink-0 items-center justify-between border-b px-6',
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e
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
        <Favorites
          items={favorites}
          totalCount={favorites.length}
          title={favoritesTitle}
          onToggleFavorite={onToggleFavorite}
        />
      )}

<<<<<<< HEAD
      {/* Browse toolbar (title, view toggle, sort, search, filters, tabs) */}
      <Toolbar
        totalCount={filteredItems.length}
=======
      {/* Browse toolbar */}
      <CatalogBrowseToolbar
        totalCount={items.length}
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e
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
<<<<<<< HEAD
            'flex min-h-0 flex-1 overflow-auto pt-5',
            styles.gridView,
          )}
        >
          <CardGrid
            items={filtered}
=======
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
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e
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
<<<<<<< HEAD
        <div className={mergeClasses('flex min-h-0 flex-1', styles.listView)}>
          <ListView
            items={filtered}
            query={query}
            ariaLabel={resolvedAriaLabel}
            emptyStateTitle={emptyTitle}
          />
        </div>
      )}
    </section>
=======
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
>>>>>>> b4b22eef2c3e54e0f61784c59613d383bcdd3a5e
  );
};
