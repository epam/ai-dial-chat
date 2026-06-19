import type { TabModel } from '@epam/ai-dial-ui-kit';
import type {
  CatalogItem,
  CatalogSortOption,
  FavoriteItem,
  TreeNode,
} from './CatalogItem';
import type { CatalogStyles } from './CatalogStyles';

/** Text labels used by the `Catalog` surface. */
export interface CatalogTexts {
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
  /** "No results" description. Default: 'Try a different keyword'. */
  noResultsDescription?: string;
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
  texts?: CatalogTexts;
  /** Whether catalog data is loading (reserved for future loading state). */
  isLoading?: boolean;
  /** Error to display if data loading failed (reserved for future error state). */
  error?: Error | null;
  /** Called when any item's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the "Use in chat" button is clicked in the details panel. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Called when the "Share" button is clicked in the details panel. */
  onShare?: (item: CatalogItem) => void;
  /**
   * Called when the details panel opens for an item. Use this to fetch
   * enriched About-tab content from an API and pass it back as a string.
   * Returns `undefined` to let the panel fall back to `item.longDescription`.
   */
  onFetchAboutContent?: (item: CatalogItem) => Promise<string | undefined>;
  /** Called when the Create button is clicked. */
  onCreateClick?: () => void;
  /** Tab definitions for entity-type filtering. */
  tabs?: TabModel[];
  /** Available sort options. Default: DEFAULT_SORT_OPTIONS. */
  sortOptions?: CatalogSortOption[];
  /** Maturity filter options. Default: DEFAULT_MATURITY_OPTIONS. */
  maturityOptions?: string[];
  /** Use-case filter options. Default: DEFAULT_USE_CASE_OPTIONS. */
  useCaseOptions?: string[];
  /** Domain filter options. Default: DEFAULT_DOMAIN_OPTIONS. */
  domainOptions?: string[];
  /** "From" source tree. Default: DEFAULT_FROM_TREE. */
  fromTree?: TreeNode[];
  /** All "from" IDs (determines initial filter state). Default: DEFAULT_ALL_FROM_IDS. */
  allFromIds?: Set<string>;
  /**
   * Returns the "no results" heading given the active query.
   * Default: (q) => `No results for "${q}"`.
   */
  noResultsTitle?: (query: string) => string;
  /** Optional color and typography overrides. */
  styles?: CatalogStyles;
}
