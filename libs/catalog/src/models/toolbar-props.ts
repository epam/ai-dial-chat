import { SelectOption } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import { CatalogViewMode } from '../types/view-mode';

/** Typography class overrides for `Toolbar`. */
export interface ToolbarTypography {
  /** Typography class for the section title. Default: `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-semi-text'`. */
  countClassName?: string;
  /** Typography class for the filter section label. Default: `'dial-tiny-lead-semi-text'`. */
  filterSectionLabelClassName?: string;
  /** Typography class for the filter checkbox labels. Default: `'dial-small-semi-text'`. */
  filterButtonClassName?: string;
}

/** Color overrides for `Toolbar`, applied via CSS custom properties. */
export interface ToolbarColors {
  /** Section title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Total count text color. Fallback: `--text-secondary`. */
  countText?: string;
  /** Vertical divider color next to sort dropdown. Fallback: `--stroke-secondary`. */
  divider?: string;
  /** Dot on the mobile browse-settings button while a filter is applied. Fallback: `--bg-control-accent`. */
  settingsActiveDot?: string;
}

/** Grouped style overrides for `Toolbar`. */
export interface ToolbarStyles {
  /** Typography class overrides for heading and count. */
  typography?: ToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ToolbarColors;
}

/** Text of the mobile browse-settings sheet. Every field has an English default in `Toolbar`. */
export interface BrowseSettingsSheetLabels {
  /** Title of the root page. Default: 'Browse settings'. */
  title: string;
  /** Root row and page title for the view mode. Default: 'View'. */
  view: string;
  /** Root row and page title for the sort order. Default: 'Sorting'. */
  sorting: string;
  /** Root row and page title for the filters. Default: 'Filtering'. */
  filtering: string;
  /** Grid view option. Default: 'Cards'. */
  gridView: string;
  /** List view option. Default: 'List'. */
  listView: string;
  /** Label of the "My" filter row. Default: 'My'. */
  myApps: string;
  /** Heading of the topics section. Default: 'Topics'. */
  topics: string;
  /** Filter footer Clear button. Default: 'Clear'. */
  clear: string;
  /** Filter footer Apply button. Default: 'Apply'. */
  apply: string;
  /** Accessible name of the header's back button. Default: 'Back'. */
  back: string;
  /** Accessible name of the header's close button. Default: 'Close'. */
  close: string;
  /** Formats the applied-filter summary on the root Filtering row. Default: `${selected} of ${total}`. */
  formatFilterCount: (selected: number, total: number) => string;
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
  /**
   * Renders in place of the `title`/`totalCount` heading when supplied, e.g.
   * so a host can render a clickable breadcrumb instead of a plain text
   * label.
   */
  browseHeaderRenderer?: ReactNode;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /** Accessible label for switching to grid view. Default: 'Grid view'. */
  gridViewLabel?: string;
  /** Accessible label for switching to list view. Default: 'List view'. */
  listViewLabel?: string;
  /** Accessible label naming the grid/list view toggle group. Default: 'View mode'. */
  viewToggleLabel?: string;
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
  /**
   * Values the sort menu lists. Only the values — the toolbar owns which one
   * is marked as applied and what a click does.
   */
  sortOptions?: SelectOption[];
  /** Called with the picked option's `value` when the sort order changes. */
  onSortChange?: (sortKey: string) => void;
  /** The sort control's own name, prepended to its accessible name. Default: 'Sort'. */
  sortLabel?: string;
  /** Text of the mobile browse-settings button and sheet; `title` also names the button. `myApps`/`topics` fall back to `filterMyAppsLabel`/`filterTopicsLabel`. */
  browseSettingsLabels?: Partial<BrowseSettingsSheetLabels>;
}
