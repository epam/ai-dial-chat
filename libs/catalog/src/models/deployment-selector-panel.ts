import type { DeploymentSelectorExtraOption } from '../components/DeploymentSelectorField/DeploymentSelectorField';
import type { DeploymentSelectorLayout } from '../types/deployment-selector-layout';
import type { CatalogItem } from './catalog-item';

/** Localizable string labels for `DeploymentSelectorPanel`. */
export interface DeploymentSelectorPanelLabels {
  /** Placeholder and accessible label for the search input. Default: `'Search models, agents…'`. */
  searchPlaceholder?: string;
  /** Accessible label for the clear-search button. Default: `'Clear search'`. */
  clearSearchLabel?: string;
  /** Heading above the favorites list in the sectioned layout. Default: `'Favorites'`. */
  favoritesLabel?: string;
  /** Hint shown when Favorites is empty. Default: `'Star a model or agent to pin it here.'`. */
  emptyHint?: string;
  /** Label for the footer action button. Default: `'Catalog'`. */
  browseCatalogLabel?: string;
  /** Accessible label for the remove-from-favorites button. Default: `'Remove from favorites'`. */
  removeFromFavoritesLabel?: string;
  /** Heading above the currently-selected row in the sectioned layout. Default: `'Currently selected'`. */
  currentlySelectedLabel?: string;
  /** Accessible label for the add-to-favorites button. Default: `'Add to favorites'`. */
  addToFavoritesLabel?: string;
  /** Accessible label for the list of selectable deployments. Default: `'Select model'`. */
  listAriaLabel?: string;
  /** Note on a selected row whose deployment the operator has hidden. Default: `'Unavailable'`. */
  unavailableLabel?: string;
}

/** Color overrides for `DeploymentSelectorPanel`, applied as CSS custom properties. */
export interface DeploymentSelectorPanelColors {
  /** Background of the search header, sticky heading and footer. Fallback: `--bg-layer-raised`. */
  surface?: string;
  /** Section heading text color. Fallback: `--text-tertiary`. */
  sectionHeading?: string;
  /** Empty-favorites hint text color. Fallback: `--text-secondary`. */
  emptyHint?: string;
  /** Footer top border color. Fallback: `--stroke-tertiary`. */
  footerBorder?: string;
  /** Filled star icon color. Fallback: `--text-warning-icon`. */
  starFilled?: string;
}

/** Props for `DeploymentSelectorPanel`. */
export interface DeploymentSelectorPanelProps {
  /** Controlled search value, retained by the host across sheet/popover replacement. Defaults to local state. */
  searchQuery?: string;
  /** Called when the user changes or clears the search value. */
  onSearchQueryChange?: (query: string) => void;
  /** Starred catalog items to display in the Favorites list. */
  favorites: CatalogItem[];
  /** Non-deployment rows rendered above every catalog section. Defaults to none. */
  extraOptions?: DeploymentSelectorExtraOption[];
  /** Operator-default item pinned ahead of favorites, whether starred or not. */
  pinnedItem?: CatalogItem;
  /** Whether the pinned row carries a favourite toggle. Defaults to `true`. */
  canFavoritePinnedItem?: boolean;
  /** ID of the currently selected deployment. */
  selectedId?: string | null;
  /** Full catalog item for the selection, so it can be shown even when it is not a favourite. */
  selectedItem?: CatalogItem;
  /** Returns whether an item belongs in the picker. Defaults to items listed under the Model or Agent tab. */
  isSelectableItem?: (item: CatalogItem) => boolean;
  /** Row arrangement. Defaults to `DeploymentSelectorLayout.Sectioned`. */
  layout?: DeploymentSelectorLayout;
  /** Called with the selected item's id. The panel calls `onClose` after it. */
  onSelect: (id: string) => void;
  /** Called after the row's exit animation when a star toggle is clicked. */
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<void> | void;
  /** Called when the footer button is clicked. The panel calls `onClose` after it. */
  onBrowseCatalog?: () => void;
  /** Called by the panel to request that the parent popover close. */
  onClose: () => void;
  /** Localized string overrides. */
  labels?: DeploymentSelectorPanelLabels;
  /** Color overrides, applied as CSS custom properties on the panel root. */
  colors?: DeploymentSelectorPanelColors;
  /** CSS class of the section headings. Defaults to `'dial-tiny-lead-semi-text'`. */
  sectionHeadingClassName?: string;
  /** CSS class of each row's name. Defaults to `'dial-small-text'`. */
  itemNameClassName?: string;
  /** CSS class of the empty-favorites hint. Defaults to `'dial-small-text'`. */
  emptyHintClassName?: string;
  /** Additional classes merged over the panel root's defaults. */
  className?: string;
}
