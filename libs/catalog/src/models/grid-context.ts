import { ListViewTypography } from './list-props';

/** ag-grid context shape passed to all cell renderers. */
export interface GridContext {
  /** Search query forwarded to cell renderers for text highlighting. */
  searchQuery: string;
  /** Typography class overrides for list cells. */
  typography: ListViewTypography;
  /** Called when the star button is toggled in a row. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
  /** Credentials-status badge label shown when signed out. */
  credentialsBadgeLoggedOutLabel?: string;
}
