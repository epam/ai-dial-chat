import type { CatalogItem } from './catalog-item';

/** Text overrides for `CardGrid` empty state. */
export interface CardGridTitles {
  /** Empty-state heading text. Default: `'No results'`. */
  noResultsTitle?: string;
  /** Label for the "Featured" tag on cards. Default: `'Featured'`. */
  featuredLabel?: string;
  /** Accessible label for the star button when the item is not starred. Default: `'Add to favorites'`. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: `'Remove from favorites'`. */
  removeFromFavoritesAriaLabel?: string;
  /** Credentials-status badge label shown on cards when signed out. Default: `'LOGGED OUT'`. */
  credentialsBadgeLoggedOutLabel?: string;
}

/** Props for `CardGrid`. */
export interface CardGridProps {
  /** Items to display in the 3-column grid. */
  items: CatalogItem[];
  /** Active search query forwarded to each `Card` for highlighting. */
  query?: string;
  /** Called when a card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Grouped empty-state text overrides. */
  titles?: CardGridTitles;
  /** Called when a card body is clicked. */
  onItemClick?: (item: CatalogItem) => void;
  /** When true, renders skeleton placeholder cards instead of actual content. */
  isLoading?: boolean;
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
  /** Skeleton bar/shape color while loading. Defaults to `--cg-skeleton-color`. */
  skeletonColor?: string;
  /** Background color of a skeleton placeholder card. Fallback: `--bg-layer-raised`. */
  skeletonCardBackground?: string;
}
