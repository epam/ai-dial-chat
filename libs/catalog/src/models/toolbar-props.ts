import { SelectOption } from '@epam/ai-dial-ui-kit';
import type { ReactNode, Ref } from 'react';
import type { FolderTreeColors } from '../components/CatalogFolderTree/CatalogFolderTree';
import type { FoldersButtonColors } from '../components/FoldersButton/FoldersButton';
import type { CatalogFolderSelection } from '../types/catalog-folders';
import { CatalogViewMode } from '../types/view-mode';
import type { CatalogFolderLabels, CatalogFolderNode } from './catalog-folders';

/** Typography class overrides for `Toolbar`. */
export interface ToolbarTypography {
  /** Typography class for the section title. Default: `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-semi-text'`. */
  countClassName?: string;
  /** Typography class for the filter section label. Default: `'dial-tiny-lead-semi-text'`. */
  filterSectionLabelClassName?: string;
  /** Typography class added to the topic checkbox labels. Default: none, so the kit row's own text class applies. */
  filterButtonClassName?: string;
  /** Typography class for the folder tree rows. Default: `'dial-small-text'`. */
  folderTreeRowClassName?: string;
}

/** Color overrides for `Toolbar`, applied via CSS custom properties. */
export interface ToolbarColors {
  /** Section title text color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Total count text color. Fallback: `--text-secondary`. */
  countText?: string;
  /** Dot on the mobile browse-settings button and the desktop filter button while a topic is applied. Fallback: `--bg-control-accent`. */
  settingsActiveDot?: string;
}

/** Grouped style overrides for `Toolbar`. */
export interface ToolbarStyles {
  /** Typography class overrides for heading and count. */
  typography?: ToolbarTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ToolbarColors;
  /** Color overrides of the Folders control. */
  foldersButton?: FoldersButtonColors;
  /** Color overrides of the folder tree inside the Folders control. */
  folderTree?: FolderTreeColors;
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
  /** Heading of the topics section. Default: 'Topics'. */
  topics: string;
  /** Filtering page header button that clears every topic. Default: 'Clear all'. */
  clearAll: string;
  /** Accessible name of the header's back button. Default: 'Back'. */
  back: string;
  /** Accessible name of the header's close button. Default: 'Close'. */
  close: string;
  /** Formats the applied-topic summary on the root Filtering row. Default: `${selected} of ${total}`. */
  formatFilterCount: (selected: number, total: number) => string;
}

/** Props for Toolbar. */
export interface ToolbarProps {
  /** Item count shown next to the heading or the breadcrumb trail. */
  totalCount?: number;
  /** Current display mode. */
  viewMode: CatalogViewMode;
  /** Called when the display mode changes. */
  onViewModeChange: (mode: CatalogViewMode) => void;
  /**
   * Called when the user is likely about to change the display mode: the
   * pointer enters or focus reaches the view toggle, or the phone browse
   * settings sheet opens. `Catalog` uses it to prepare the hidden list view.
   */
  onViewModeIntent?: () => void;
  /** Current search query. */
  query: string;
  /** Called when the query changes. */
  onQueryChange: (q: string) => void;
  /** Heading text while All entities is selected. Default: 'All entities'. */
  title?: string;
  /**
   * Renders in place of the folder heading (`title`/`totalCount` or the
   * breadcrumb trail) when supplied; the Folders control still follows it.
   */
  browseHeaderRenderer?: ReactNode;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /** Ref attached to the search `<input>`, e.g. so the host can focus it. */
  searchInputRef?: Ref<HTMLInputElement>;
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
  /** Called with the new selection on every topic toggle, tag removal or "Clear all". */
  onFiltersChange?: (filters: Set<string>) => void;
  /** All available topic strings shown as checkboxes in the filter dropdown. */
  filterValues?: Set<string>;
  /** Label for the Topics section inside the filter dropdown. Default: 'Topics'. */
  filterTopicsLabel?: string;
  /** Accessible name and tooltip of the icon-only topic filter trigger. Default: 'Filter by topic'. */
  filterLabel?: string;
  /** Text of the buttons that clear every topic. Default: 'Clear all'. */
  filterClearAllLabel?: string;
  /** Accessible name of the applied-topic tag group. Default: 'Applied topics'. */
  appliedTopicsLabel?: string;
  /** Returns the accessible name of a tag's remove button. Default: `` (topic) => `Remove ${topic}` ``. */
  formatRemoveTopicLabel?: (topic: string) => string;
  /** Currently active sort key. */
  sortKey?: string;
  /**
   * Values the sort menu lists. Only the values — the toolbar owns which one
   * is marked as applied and what a click does.
   */
  sortOptions?: SelectOption[];
  /** Called with the picked option's `value` when the sort order changes. */
  onSortChange?: (sortKey: string) => void;
  /** Accessible name and tooltip of the icon-only sort button. Default: 'Sort'. */
  sortLabel?: string;
  /** Text of the mobile browse-settings button and sheet; `title` also names the button. `topics`/`clearAll` fall back to `filterTopicsLabel`/`filterClearAllLabel`. */
  browseSettingsLabels?: Partial<BrowseSettingsSheetLabels>;
  /** Folder tree listed by the Folders control; the control is hidden when omitted. */
  folderTree?: CatalogFolderNode[];
  /** Selected folder. Default: All entities (`{ path: [] }`). */
  folderSelection?: CatalogFolderSelection;
  /** Called with the picked folder from the tree or the breadcrumb trail. */
  onFolderSelectionChange?: (selection: CatalogFolderSelection) => void;
  /** Text of the folder navigation. Default: `DEFAULT_CATALOG_FOLDER_LABELS`, with `allEntities` taken from `title`. */
  folderLabels?: Partial<CatalogFolderLabels>;
}
