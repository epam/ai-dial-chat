import type {
  PublicationRule,
  PublishFolderNode,
  PublishFooterLabels,
  PublishHistoryEntry,
  PublishPanelLabels,
} from '@epam/ai-dial-publish-panel';
import type { ReactNode } from 'react';
import type { CatalogEntityType } from '../types/entity-type';
import type { CatalogSortKey } from '../types/sort';
import type { CredentialsLevel } from '../types/toolset-auth';
import type { CatalogViewMode } from '../types/view-mode';
import type { CatalogItem } from './catalog-item';
import type { CatalogStyles } from './catalog-styles';
import type { CatalogItemDetailsFetchResult } from './item-details-data';
import type { ItemDetailsTexts } from './item-details-props';

/** A single option in the Create dropdown. */
export interface CreateOption {
  /** Display label shown in the dropdown menu. */
  label: string;
  /** Short description shown below the label (single line, truncated). */
  description?: string;
  /** Leading icon rendered inside a tinted 32 px square. */
  icon?: ReactNode;
  /**
   * Tailwind classes applied to the icon container — controls background tint
   * and icon color.
   */
  iconContainerClassName?: string;
  /** Called when this option is selected. */
  onClick: () => void;
}

/** Text labels used by the `Catalog` surface. */
export interface CatalogTitles {
  /** Page heading. Default: 'Catalog'. */
  pageTitle?: string;
  /** Create button label. Default: 'Create'. */
  createLabel?: string;
  /** Favorites section heading. Default: 'Your Favorites'. */
  favoritesTitle?: string;
  /** Browse section heading. Default: 'Browse'. */
  browseTitle?: string;
  /** Search input placeholder. Default: 'Search models, tools, agents…'. */
  searchPlaceholder?: string;
  /**
   * Returns the "no results" heading given the active query.
   * Default: (q) => `No results for "${q}"`.
   */
  noResultsTitle?: (query: string) => string;
  /** Label for the "Recently Updated" sort option. Default: 'Recently Updated'. */
  sortRecentlyUpdatedLabel?: string;
  /** Label for the "Newest" sort option. Default: 'Newest'. */
  sortNewestLabel?: string;
  /** Label for the "Name A-Z" sort option. Default: 'Name A-Z'. */
  sortNameAZLabel?: string;
  /** Label for the "Featured" tag on cards. Default: 'Featured'. */
  featuredLabel?: string;
  /** Accessible label for switching to grid view. Default: 'Grid view'. */
  gridViewLabel?: string;
  /** Accessible label for switching to list view. Default: 'List view'. */
  listViewLabel?: string;
  /** ARIA label for the page/grid. Default: 'Catalog'. */
  ariaLabel?: string;
  /**
   * Display labels for entity-type filter tabs. Only types present in `items`
   * are shown. Defaults: Model → 'Model', Agent → 'Agent', Toolset → 'Toolset',
   * Guardrail → 'Guardrail', Skill → 'Skill', Mcp → 'MCP'.
   */
  tabLabels?: Partial<Record<CatalogEntityType, string>>;
  /** Label for the filter button when nothing is filtered. Default: 'From'. */
  filterFromLabel?: string;
  /** Label for the "My Apps" filter checkbox. Default: 'My'. */
  filterMyAppsLabel?: string;
  /** Label for the Topics section inside the filter dropdown. Default: 'Topics'. */
  filterTopicsLabel?: string;
}

/** Props for Catalog. */
export interface CatalogProps {
  /** Items to display in the Browse section. */
  items: CatalogItem[];
  /** Items to display in the Favorites section. */
  favorites: CatalogItem[];
  /** Grouped text labels for headings and actions. */
  titles?: CatalogTitles;
  /** Whether catalog data is loading (reserved for future loading state). */
  isLoading?: boolean;
  /** Error to display if data loading failed (reserved for future error state). */
  error?: Error | null;
  /** Called when any item's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the "Use in chat" button is clicked in the details panel. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Controls whether the primary action button is shown for an item. */
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Share" button is clicked in the details panel. */
  onShare?: (item: CatalogItem) => void;
  /** Controls whether the "Publish" action is shown for an item. */
  isPublishVisible?: (item: CatalogItem) => boolean;
  /** Resolves previously published versions for an item, most recent first. */
  getPublishHistory?: (item: CatalogItem) => Promise<PublishHistoryEntry[]>;
  /** Root-level destination folder nodes offered by the publish flow. */
  publishFolderItems?: PublishFolderNode[];
  /**
   * Externally-controlled set of expanded publish-folder path keys
   * (`path.join('/')`). Pass this together with `onPublishExpandedPathsChange`
   * when the host lazily fetches a folder's children on expand.
   */
  publishExpandedPaths?: Set<string>;
  /** Called when the set of expanded publish folders changes; required to control `publishExpandedPaths`. */
  onPublishExpandedPathsChange?: (paths: Set<string>) => void;
  /** Publish-folder path keys currently being fetched by the host. */
  publishLoadingPaths?: Set<string>;
  /** Resolves whether the current user can publish to a given folder path. */
  hasPublishWriteAccess?: (folderPath: string[]) => boolean;
  /** Called with the destination folder path and current access rules when the user confirms publish/update. */
  onPublish?: (
    item: CatalogItem,
    folderPath: string[],
    rules: PublicationRule[],
  ) => Promise<void>;
  /** Called after a successful publish; use this to surface a success notification. */
  onPublishSuccess?: (item: CatalogItem, folderPath: string[]) => void;
  /** Called when the user confirms a new folder name in the publish flow. */
  onCreatePublishFolder?: (parentPath: string[], name: string) => void;
  /** Text overrides forwarded to the publish flow. */
  publishLabels?: PublishPanelLabels & PublishFooterLabels;
  /** Options offered in the access-rules editor's source picker. Defaults to `[]` when absent. */
  ruleSourceOptions?: string[];
  /**
   * Resolves the access rules already configured for a destination folder,
   * called whenever the selected folder changes. The result fully replaces
   * the rules editor's contents. Omit to skip pre-filling entirely.
   */
  onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
  /** Called when the "Edit" button is clicked in the details panel. Shown only when the item's `isEditable` is `true`. */
  onEdit?: (item: CatalogItem) => void;
  /**
   * Called immediately when the "Delete" button in the details panel is
   * clicked, with no confirmation step. Shown only when the item's `isMyApp`
   * is `true` and its `type` is `Application` or `Toolset`. May return a
   * promise; the button shows a disabled state while pending.
   */
  onDelete?: (item: CatalogItem) => Promise<void> | void;
  /**
   * Renders the Share popover content anchored to the Share button in the
   * details panel. When provided, clicking Share opens this popover instead
   * of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Additional caller-supplied rule for whether the "Share" action is shown
   * for the item, combined (AND) with the built-in ownership/type rule.
   * Absent means the built-in rule alone decides.
   */
  isShareVisible?: (item: CatalogItem) => boolean;
  /**
   * Renders the Connect popover content anchored to the Connect button in the
   * details panel. When absent, the Connect button is never shown — there is
   * no non-overlay fallback action.
   */
  connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Controls whether the "Connect" action is shown for an item. When absent,
   * the Connect button is never shown.
   */
  isConnectVisible?: (item: CatalogItem) => boolean;
  /**
   * Called when the credentials login form is submitted in the details
   * panel, for the given credentials `level` (`USER` or `GLOBAL`). May
   * return a promise; awaited before refreshing via `onFetchDetails`.
   */
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /**
   * Called when logout is confirmed in the details panel's credentials
   * section, for the given credentials `level`. May return a promise;
   * awaited before refreshing via `onFetchDetails`.
   */
  onLogout?: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void> | void;
  /**
   * Called when the details panel opens for an item. Use this to fetch
   * structured tab data (Overview/Pricing/API/Tools) from an API and pass it
   * back. The resolved data takes precedence over the item's static `details`
   * field for the currently open item. Returns `undefined` to let the panel
   * fall back to `item.details`.
   */
  onFetchDetails?: (
    item: CatalogItem,
  ) => Promise<CatalogItemDetailsFetchResult | undefined>;
  /**
   * Dropdown options for the Create button. When provided, the button opens a
   * menu instead of calling `onCreateClick` directly.
   */
  createOptions?: CreateOption[];
  /** Called when the Create button is clicked (used when `createOptions` is absent). */
  onCreateClick?: () => void;
  /** Hides the "Create" button entirely, e.g. when rendering as a read-only picker. Default: false. */
  hideCreateButton?: boolean;
  /** Hides the page heading (title row), e.g. when the host renders its own title outside the catalog. Default: false. */
  hidePageTitle?: boolean;
  /** Initial Browse view mode (grid or list). Default: `CatalogViewMode.Grid`. */
  initialViewMode?: CatalogViewMode;
  /** ID of an item to visually mark as selected (border, tint, and checkmark) in the Browse grid. */
  selectedItemId?: string;
  /**
   * ID of an item whose details panel should open automatically, e.g. when
   * deep-linking from a share invitation. Opens once per distinct id;
   * ignored if no matching item is found in `items`.
   */
  initialDetailsItemId?: string;
  /**
   * When provided, clicking a card in the Browse grid calls this instead of
   * opening the details panel — e.g. to mark it selected in a picker.
   */
  onCardClick?: (item: CatalogItem) => void;
  /** Optional color and typography overrides. */
  styles?: CatalogStyles;
  /** Text overrides forwarded to the item details panel. */
  detailsTexts?: ItemDetailsTexts;
  /**
   * Externally-controlled active sort key. When omitted, `Catalog` manages
   * its own sort state internally, defaulting to `CatalogSortKey.RecentlyUpdated`.
   */
  sortKey?: CatalogSortKey;
  /** Called when the user changes the sort option; required to control `sortKey`. */
  onSortChange?: (key: CatalogSortKey) => void;
  /**
   * Externally-controlled set of active "From" topic filter values. When
   * omitted, `Catalog` manages its own filter state internally, defaulting to
   * an empty set (no topics filtered).
   */
  filterTopics?: Set<string>;
  /** Called when the user applies a new topic filter selection; required to control `filterTopics`. */
  onFilterTopicsChange?: (topics: Set<string>) => void;
  /**
   * Externally-controlled "My Apps" filter toggle. When omitted, `Catalog`
   * manages its own state internally, defaulting to `false`.
   */
  isMyAppsActive?: boolean;
  /** Called when the user toggles the "My Apps" filter; required to control `isMyAppsActive`. */
  onMyAppsActiveChange?: (isActive: boolean) => void;
}
