import { CatalogListViewTypography } from '../components/CatalogListView/CatalogListView';

/** ag-grid context shape passed to all cell renderers. */
export interface GridContext {
  /** Search query forwarded to cell renderers for text highlighting. */
  searchQuery: string;
  /** Typography class overrides for list cells. */
  typography: CatalogListViewTypography;
}
