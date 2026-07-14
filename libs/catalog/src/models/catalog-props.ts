import type { ReactNode } from 'react';
import type { CatalogEntityType } from '../types/entity-type';
import type { CredentialsLevel } from '../types/toolset-auth';
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
   * and icon colour. Example: `'bg-accent-secondary-alpha text-accent-secondary'`.
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
}
