import { CatalogItem } from './catalog-item';

/** Typography class overrides for `CatalogFavorites`. */
export interface FavoritesTypography {
  /** Typography class for the section title. Default: `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-text'`. */
  countClassName?: string;
}

/** Color overrides for `CatalogFavorites`, applied via CSS custom properties. */
export interface FavoritesColors {
  /** Base section background color. Fallback: `--bg-layer-1`. */
  backgroundBase?: string;
  /** Favorites gradient start color. Fallback: `--bg-accent-tertiary-alpha`. */
  backgroundStart?: string;
  /** Favorites gradient end color. Fallback: `--bg-accent-primary-alpha`. */
  backgroundEnd?: string;
  /** Section bottom border color. Fallback: `--stroke-secondary`. */
  border?: string;
  /** Section title color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Count text color. Fallback: `--text-secondary`. */
  countText?: string;
}

/** Grouped style overrides for `CatalogFavorites`. */
export interface FavoritesStyles {
  /** Typography class overrides for title and count. */
  typography?: FavoritesTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: FavoritesColors;
}

/** Props for `CatalogFavorites`. */
export interface FavoritesProps {
  /** Favorite items to paginate and display. */
  items: CatalogItem[];
  /** Total favorites count shown in the heading (may exceed items.length). Default: items.length. */
  totalCount?: number;
  /** Section heading text. Default: 'Your Favorites'. */
  title?: string;
  /** Called when a favorite card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Grouped typography and color overrides for the section. */
  styles?: FavoritesStyles;
}
