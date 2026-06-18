import { CatalogItem } from './Catalog';

/** Typography class overrides for `CatalogListView` cells. */
export interface CatalogListViewTypography {
  /** Typography class for item name text. Default: `'dial-h3-text'`. */
  nameClassName?: string;
  /** Typography class for item version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for item description text. Default: `'dial-small-text'`. */
  descriptionClassName?: string;
  /** Typography class for folder path text. Default: `'dial-small-text'`. */
  folderClassName?: string;
}

/** Color overrides for `CatalogListView` cells, applied via CSS custom properties. */
export interface CatalogListViewColors {
  /** Color for item name text. Fallback: `--text-primary`. */
  nameText?: string;
  /** Color for version/description/folder text. Fallback: `--text-secondary`. */
  secondaryText?: string;
}

/** Combined style overrides for `CatalogListView`. */
export interface CatalogListViewStyles {
  /** Typography class overrides. */
  typography?: CatalogListViewTypography;
  /** Color overrides applied as CSS variables. */
  colors?: CatalogListViewColors;
}

/** Props for CatalogListView. */
export interface CatalogListViewProps {
  /** Items to display in the table. */
  items: CatalogItem[];
  /** Active search query — passed through grid context so cell renderers can highlight. */
  query?: string;
  /** ARIA label for the grid element. Default: 'Catalog'. */
  ariaLabel?: string;
  /** Grid empty-state title. */
  emptyStateTitle?: string;
  /** Grid empty-state description. */
  emptyStateDescription?: string;
  /** Grouped typography and color overrides for table cells. */
  styles?: CatalogListViewStyles;
}
