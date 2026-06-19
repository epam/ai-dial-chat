import { CatalogViewMode } from '../types/view-mode';
import { CatalogSortOption } from './sort';

/** Typography class overrides for `Toolbar`. */
export interface ToolbarTypography {
  /** Typography class for the section title. Default: `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-text'`. */
  countClassName?: string;
}

/** Color overrides for `Toolbar`, applied via CSS custom properties. */
export interface ToolbarColors {
  /** Section background color. Fallback: `--bg-layer-1`. */
  background?: string;
  /** Section title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Total count text color. Fallback: `--text-secondary`. */
  countText?: string;
  /** Filter icon color. Fallback: `--text-secondary`. */
  icon?: string;
  /** Vertical divider color next to sort dropdown. Fallback: `--stroke-secondary`. */
  divider?: string;
  /** Clear-all button text color. Fallback: `--text-error`. */
  clearAll?: string;
  /** Bottom border color of tabs row. Fallback: `--stroke-secondary`. */
  tabsBorder?: string;
}

/** Grouped style overrides for `Toolbar`. */
export interface ToolbarStyles {
  /** Typography class overrides for heading and count. */
  typography?: ToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ToolbarColors;
}

/** Props for Toolbar. */
export interface ToolbarProps {
  /** Total item count shown next to the "Browse" heading. */
  totalCount?: number;
  /** Current display mode. */
  viewMode: CatalogViewMode;
  /** Called when the display mode changes. */
  onViewModeChange: (mode: CatalogViewMode) => void;
  /** Current sort key. */
  sortKey: string;
  /** Called when sort changes. */
  onSortChange: (key: string) => void;
  /** Current search query. */
  query: string;
  /** Called when the query changes. */
  onQueryChange: (q: string) => void;
  /** Whether at least one filter is active. */
  isAnyFilterActive: boolean;
  /** Called when "Clear all" is clicked. */
  onClearFilters: () => void;
  /** Section heading text. Default: 'Browse'. */
  title?: string;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /** Sort dropdown options. Default: DEFAULT_SORT_OPTIONS. */
  sortOptions?: CatalogSortOption[];
  /** Grouped typography and color overrides. */
  styles?: ToolbarStyles;
  /** Label for the "Clear all" filters button. Default: 'Clear all'. */
  clearAllLabel?: string;
}
