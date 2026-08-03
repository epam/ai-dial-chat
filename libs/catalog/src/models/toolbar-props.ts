import { CatalogViewMode } from '../types/view-mode';

/** A single option in the sort dropdown. */
export interface CatalogSortOption {
  /** Sort key passed to `onSortChange`. */
  value: string;
  /** Display label shown in the dropdown. */
  label: string;
}

/** Typography class overrides for `Toolbar`. */
export interface ToolbarTypography {
  /** Typography class for the section title. Default: `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-text'`. */
  countClassName?: string;
  /** Typography class for the filter section label. Default: `'dial-tiny-semi-text'`. */
  filterSectionLabelClassName?: string;
  /** Typography class for the filter checkbox labels. Default: `'dial-small-semi-text'`. */
  filterButtonClassName?: string;
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
  /** Current search query. */
  query: string;
  /** Called when the query changes. */
  onQueryChange: (q: string) => void;
  /** Section heading text. Default: 'Browse'. */
  title?: string;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /** Accessible label for switching to grid view. Default: 'Grid view'. */
  gridViewLabel?: string;
  /** Accessible label for switching to list view. Default: 'List view'. */
  listViewLabel?: string;
  /** Grouped typography and color overrides. */
  styles?: ToolbarStyles;
  /** Currently selected topic filters. Empty set means no topic filter is active. */
  filters?: Set<string>;
  /** Called when the topic filter selection changes. */
  onFiltersChange?: (filters: Set<string>) => void;
  /** All available topic strings shown as checkboxes in the filter dropdown. */
  filterValues?: Set<string>;
  /** Whether the "My Apps" filter checkbox is active. */
  isMyAppsActive?: boolean;
  /** Called when the "My Apps" toggle changes. */
  onMyAppsChange?: (isActive: boolean) => void;
  /** Label for the filter button when nothing is filtered. Default: 'From'. */
  filterFromLabel?: string;
  /** Label for the "My" filter checkbox. Default: 'My'. */
  filterMyAppsLabel?: string;
  /** Label for the Topics section inside the filter dropdown. Default: 'Topics'. */
  filterTopicsLabel?: string;
  /** Currently active sort key. */
  sortKey?: string;
  /** Called when the user selects a different sort option. */
  onSortChange?: (key: string) => void;
  /** Available sort options shown in the dropdown. */
  sortOptions?: CatalogSortOption[];
}
