import { CatalogItem } from './catalog-item';

/** Typography class overrides for `ListView` cells. */
export interface ListViewTypography {
  /** Typography class for item name text. Default: `'dial-h3-text'`. */
  nameClassName?: string;
  /** Typography class for item version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for item description text. Default: `'dial-small-text'`. */
  descriptionClassName?: string;
  /** Typography class for folder path text. Default: `'dial-small-text'`. */
  folderClassName?: string;
  /** Typography class for the last (deepest) folder segment. Default: `'dial-small-semi-text'`. */
  folderLastSegmentClassName?: string;
}

/** Color overrides for `ListView` cells, applied via CSS custom properties. */
export interface ListViewColors {
  /** Color for item name text. Fallback: `--text-primary`. */
  nameText?: string;
  /** Color for version/description/folder text. Fallback: `--text-secondary`. */
  secondaryText?: string;
}

/** Combined style overrides for `ListView`. */
export interface ListViewStyles {
  /** Typography class overrides. */
  typography?: ListViewTypography;
  /** Color overrides applied as CSS variables. */
  colors?: ListViewColors;
}

/** Props for ListView. */
export interface ListViewProps {
  /** Items to display in the table. */
  items: CatalogItem[];
  /** Active search query — passed through grid context so cell renderers can highlight. */
  query?: string;
  /** ARIA label for the grid element. Default: 'Catalog'. */
  ariaLabel?: string;
  /** Grid empty-state title. */
  emptyStateTitle?: string;
  /** Grouped typography and color overrides for table cells. */
  styles?: ListViewStyles;
  /** Called when the star icon is toggled on a row. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when a table row is clicked (excluding the star column). */
  onItemClick?: (item: CatalogItem) => void;
  /**
   * When set, the ag-grid column header becomes `position: sticky` at this
   * pixel offset from the scroll container's top edge. Pass the height of any
   * sticky UI above the list (e.g. the catalog page heading) so the header
   * sits flush below it while the page scrolls.
   */
  stickyHeaderTop?: number;
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
}
