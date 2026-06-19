import type { CatalogListViewTypography } from './CatalogListViewProps';

/** ag-grid context shape passed to all cell renderers. */
export interface GridContext {
  /** Search query forwarded to cell renderers for text highlighting. */
  searchQuery: string;
  /** Typography class overrides for list cells. */
  typography: CatalogListViewTypography;
  /** Called when the star button is toggled in a row. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
}
