import type { CatalogItem } from './catalog-item';

/** Typography class overrides for `Card` content. */
export interface CardTypography {
  /** Typography class applied to the item name. Default: `'dial-h3-text'`. */
  nameClassName?: string;
  /** Typography class applied to the version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class applied to the description text. Default: `'dial-small-text'`. */
  descriptionClassName?: string;
  /** Typography class applied to the featured chip label. Default: `'dial-tiny-semi-text uppercase tracking-[0.06em]'`. */
  featuredChipClassName?: string;
  /** Typography class applied to folder path separator labels. Default: `'dial-tiny-text'`. */
  folderLabelClassName?: string;
  /** Typography class applied to the leaf (last) folder path segment. Default: `'dial-tiny-semi-text'`. */
  folderLeafClassName?: string;
}

/** Color overrides applied as CSS custom properties for `Card`. */
export interface CardColors {
  /** Default card background color. Fallback: `--bg-layer-2`. */
  background?: string;
  /** Hovered card background color. Fallback: `--bg-layer-3`. */
  hoverBackground?: string;
  /** Card border color. Fallback: `--stroke-secondary`. */
  border?: string;
  /** Featured card glow color. Fallback: `rgba(125, 164, 255, 0.5)`. */
  featuredGlow?: string;
  /** Featured top accent bar color. Fallback: `--stroke-accent-primary`. */
  featuredBar?: string;
  /** Item name and description text color. Fallback: `--text-primary`. */
  textPrimary?: string;
  /** Version text color. Fallback: `--text-secondary`. */
  textSecondary?: string;
  /** Filled star icon color. Fallback: `--text-warning-icon`. */
  starFilled?: string;
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
  /** Credentials-status badge label shown when signed out. Default: `'LOGGED OUT'`. */
  credentialsBadgeLoggedOutLabel?: string;
}
