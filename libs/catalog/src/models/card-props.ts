import type { CatalogItem } from './catalog-item';

/** Typography class overrides for `CatalogCard` content. */
export interface CatalogCardTypography {
  /** Typography class applied to the item name. Default: `'dial-h3-text'`. */
  nameClassName?: string;
  /** Typography class applied to the version text. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class applied to the description text. Default: `'dial-small-text'`. */
  descriptionClassName?: string;
}

/** Color overrides applied as CSS custom properties for `CatalogCard`. */
export interface CatalogCardColors {
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

/** Grouped style overrides for `CatalogCard`. */
export interface CatalogCardStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: CatalogCardColors;
  /** Typography class overrides for card text elements. */
  typography?: CatalogCardTypography;
}

/** Props for `CatalogCard`. */
export interface CatalogCardProps {
  /** The catalog item to display. */
  item: CatalogItem;
  /** Active search query for highlighting matches. */
  query?: string;
  /** Initial starred state. Default: false. */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** Grouped color and typography overrides. */
  styles?: CatalogCardStyles;
  /** Label for the "Featured" tag. Default: `'Featured'`. */
  featuredLabel?: string;
}
