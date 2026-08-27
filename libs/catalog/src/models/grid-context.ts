import type { CatalogItem } from './catalog-item';
import { ListViewTypography } from './list-props';

/** ag-grid context shape passed to all cell renderers. */
export interface GridContext {
  /** Search query forwarded to cell renderers for text highlighting. */
  searchQuery: string;
  /** Typography class overrides for list cells. */
  typography: ListViewTypography;
  /** Called when the star button is toggled in a row. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Rule for whether the favorite star is shown on a row; `false` hides it. Defaults to visible when omitted. */
  isFavoriteVisible?: (item: CatalogItem) => boolean;
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
  /** Accessible label for the logged-out warning icon on the entity avatar, and the text shown in its hover tooltip. */
  credentialsBadgeLoggedOutLabel?: string;
}
