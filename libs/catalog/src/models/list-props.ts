import type { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ListViewColumnVisibility } from '../components/ListView/columns';
import type { CatalogSelectionMode } from '../types/selection-mode';
import { CatalogItem } from './catalog-item';
/** Typography class overrides for `ListView` cells. */
export interface ListViewTypography {
  /** Typography class for item name text. Default: `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** Typography class for item version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for the full folder path shown in the folder cell's tooltip. Default: `'dial-small-text'`. */
  folderClassName?: string;
  /** Typography class for the last (deepest) folder segment, the one the folder cell displays. Default: `'dial-small-semi-text'`. */
  folderLastSegmentClassName?: string;
}

/** Color overrides for `ListView` cell content, applied via CSS custom properties; the table chrome is the ui-kit `Grid` theme. */
export interface ListViewColors {
  /** Color of the filled star icon in the favorite column. Fallback: `--text-warning-icon`. */
  starFilled?: string;
  /** Color of the folder icon in the folder column. Fallback: `--text-secondary`. */
  folderIcon?: string;
  /** Color of the checkmark icon in the selected row's name cell. Fallback: `--text-accent`. */
  selectedRowCheckIcon?: string;
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
  /** Type of catalog items being displayed. */
  type: CatalogEntityType;
  /** Items to display in the table. */
  items: CatalogItem[];
  /** Active search query — passed through grid context so cell renderers can highlight. */
  query?: string;
  /** ARIA label for the grid element. Default: 'Catalog'. */
  ariaLabel?: string;
  /** Grid empty-state title. Default: `'No results'`. */
  emptyStateTitle?: string;
  /** Secondary line under the grid empty-state title. Omitted when not set. */
  emptyStateDescription?: string;
  /** Grouped typography and color overrides for table cells. */
  styles?: ListViewStyles;
  /** Called when the star icon is toggled on a row. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Rule for whether the favorite star is shown on a row; `false` hides it and makes the item non-favoritable. Defaults to visible when omitted. */
  isFavoriteVisible?: (item: CatalogItem) => boolean;
  /** Called when a table row is clicked (excluding the star column), or when Enter or Space is pressed on it in single selection mode. */
  onItemClick?: (item: CatalogItem) => void;
  /** ID of an item to mark as selected (row selection state and checkmark). Ignored in `CatalogSelectionMode.Multiple`. */
  selectedItemId?: string;
  /** Row selection mode; `Multiple` adds a checkbox column with a select-all header. Default: `CatalogSelectionMode.Single`. */
  selectionMode?: CatalogSelectionMode;
  /** Ids of the selected items in `CatalogSelectionMode.Multiple`; may include ids that are not in `items`. */
  selectedItemIds?: ReadonlySet<string>;
  /** Called with the next selection in `CatalogSelectionMode.Multiple`; newly selected ids are appended, so iteration order is selection order. */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Accessible name of a row's checkbox in `CatalogSelectionMode.Multiple`. Default: `Select <item name>`. */
  selectRowAriaLabel?: (item: CatalogItem) => string;
  /** Accessible name of the select-all checkbox in `CatalogSelectionMode.Multiple`. Default: `'Select all'`. */
  selectAllAriaLabel?: string;
  /** Accessible label for the logged-out warning icon on the entity avatar, and the text shown in its hover tooltip. Default: `'Authorize to use this toolset.'`. */
  credentialsBadgeLoggedOutLabel?: string;
  /** Renders the list read-only: the "Favorite" column is dropped entirely. Default: false. */
  isReadonly?: boolean;
  /**
   * Per-column overrides for whether an optional column (`folder`, `tags`,
   * `favorite`) renders for the active tab, given its entity `type`.
   * Independent of `isFavoriteVisible` (which only gates the star on
   * individual rows, not the column). Replaces that column's built-in
   * default rule; columns omitted from this map keep their default.
   * `favorite` is additionally combined (AND) with `isReadonly`.
   */
  columnVisibility?: ListViewColumnVisibility;
}
