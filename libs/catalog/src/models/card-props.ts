import type { CatalogItem } from './catalog-item';

/** Typography class overrides for `Card` content. */
export interface CardTypography {
  /** Typography class applied to the item name. Default: `'dial-body-semi-text'`. */
  nameClassName?: string;
  /** Typography class applied to the version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class applied to the description text. Default: `'dial-small-text'`. */
  descriptionClassName?: string;
  /** Typography class applied to the last-used text. Default: `'dial-tiny-text'`. */
  descriptionSizeClassName?: string;
  /** Typography class applied to the featured chip label. Default: `'dial-tiny-lead-semi-text'`. */
  featuredChipClassName?: string;
  /** Typography class applied to folder path separator labels. Default: `'dial-tiny-text'`. */
  folderLabelClassName?: string;
  /** Typography class applied to the leaf (last) folder path segment. Default: `'dial-tiny-semi-text'`. */
  folderLeafClassName?: string;
}

/** Color overrides applied as CSS custom properties for `Card`. */
export interface CardColors {
  /** Default card background color. Fallback: `--bg-layer-sunken`. */
  background?: string;
  /** Card border color. Fallback: `--stroke-secondary`. */
  border?: string;
  /** Version text color. Fallback: `--text-secondary`. */
  textSecondary?: string;
  /** Border color of a selected card. Fallback: `--stroke-info`. */
  selectedBorder?: string;
  /** Background color (tint) of a selected card. Fallback: `--bg-control-accent-alpha-active`. */
  selectedBackground?: string;
  /** Selected-checkmark icon color. Fallback: `--text-accent`. */
  checkIcon?: string;
  /** Top border color of the footer row (folder path / star button). Fallback: `--stroke-tertiary`. */
  footerBorder?: string;
}

/** Grouped style overrides for `Card`. */
export interface CardStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: CardColors;
  /** Typography class overrides for card text elements. */
  typography?: CardTypography;
}

/** Props for `Card`. */
export interface CardProps {
  /** The catalog item to display. */
  item: CatalogItem;
  /** Optional CSS class applied to the card root element. */
  className?: string;
  /** Active search query for highlighting matches. */
  query?: string;
  /** Initial starred state. Default: false. */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** Rule for whether the favorite star is shown; `false` hides the star and makes the item non-favoritable. Defaults to visible when omitted. */
  isFavoriteVisible?: (item: CatalogItem) => boolean;
  /** Called when the card body is clicked (excluding the star button). */
  onClick?: (item: CatalogItem) => void;
  /** Grouped color and typography overrides. */
  styles?: CardStyles;
  /** Label for the "Featured" tag. Default: `'Featured'`. */
  featuredLabel?: string;
  /** Accessible label for the star button when the item is not yet starred. Default: `'Add to favorites'`. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: `'Remove from favorites'`. */
  removeFromFavoritesAriaLabel?: string;
  /** Whether this card represents the currently selected item — shows an accent border, tinted background, and a checkmark. Default: false. */
  isSelected?: boolean;
  /** Accessible label for the logged-out warning icon on the entity avatar, and the text shown in its hover tooltip. Default: `'Authorize to use this toolset.'`. */
  credentialsBadgeLoggedOutLabel?: string;
  /**
   * Renders the card as a read-only browsing surface: no favorite star, no
   * footer divider, and no "Featured" tag. The footer row is dropped entirely
   * when the item has no folder path left to show. Default: false.
   */
  isReadonly?: boolean;
}
