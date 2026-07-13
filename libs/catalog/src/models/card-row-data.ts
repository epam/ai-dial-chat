import type { CatalogItem } from './catalog-item';

/** Row data passed to each virtual row renderer in the card grid. */
export interface CardRowData {
  /** All catalog items; the renderer slices the correct row from this array. */
  items: CatalogItem[];
  /** Number of cards per row in the current viewport. */
  columnCount: number;
  /** Active search query forwarded to each card for text highlighting. */
  query: string;
  /** Called when a card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when a card body is clicked. */
  onItemClick?: (item: CatalogItem) => void;
  /** Label for the "Featured" tag rendered on featured cards. */
  featuredLabel: string;
  /** Accessible label for the star button when the item is not starred. */
  addToFavoritesAriaLabel: string;
  /** Accessible label for the star button when the item is already starred. */
  removeFromFavoritesAriaLabel: string;
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
  /** Credentials-status badge label shown when signed out. */
  credentialsBadgeLoggedOutLabel: string;
}
