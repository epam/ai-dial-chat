import type { CatalogItem, FavoriteItem } from './catalog-item';
import type { CatalogStyles } from './catalog-styles';

/** Text labels used by the `Catalog` surface. */
export interface CatalogTitles {
  /** Page heading. Default: 'Catalog'. */
  pageTitle?: string;
  /** Create button label. Default: 'Create'. */
  createLabel?: string;
  /** Favorites section heading. Default: 'Your Favorites'. */
  favoritesTitle?: string;
  /** Browse section heading. Default: 'Browse'. */
  browseTitle?: string;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /**
   * Returns the "no results" heading given the active query.
   * Default: (q) => `No results for "${q}"`.
   */
  noResultsTitle?: (query: string) => string;
  /** Label for the "Recently Updated" sort option. Default: 'Recently Updated'. */
  sortRecentlyUpdatedLabel?: string;
  /** Label for the "Newest" sort option. Default: 'Newest'. */
  sortNewestLabel?: string;
  /** Label for the "Name A-Z" sort option. Default: 'Name A-Z'. */
  sortNameAZLabel?: string;
  /** Label for the "Featured" tag on cards. Default: 'Featured'. */
  featuredLabel?: string;
  /** ARIA label for the page/grid. Default: 'Catalog'. */
  ariaLabel?: string;
}

/** Props for Catalog. */
export interface CatalogProps {
  /** Items to display in the Browse section. */
  items: CatalogItem[];
  /** Items to display in the Favorites section. */
  favorites: FavoriteItem[];
  /** Grouped text labels for headings and actions. */
  titles?: CatalogTitles;
  /** Whether catalog data is loading (reserved for future loading state). */
  isLoading?: boolean;
  /** Error to display if data loading failed (reserved for future error state). */
  error?: Error | null;
  /** Called when any item's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the Create button is clicked. */
  onCreateClick?: () => void;
  /** Optional color and typography overrides. */
  styles?: CatalogStyles;
}
