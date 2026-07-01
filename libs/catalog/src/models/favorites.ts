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
  /** Base section background color. Fallback: `--bg-layer-2`. */
  backgroundBase?: string;
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
  /** Called when a favorite card body is clicked. Opens the details panel. */
  onItemClick?: (item: CatalogItem) => void;
  /** Grouped typography and color overrides for the section. */
  styles?: FavoritesStyles;
  /** When true the section plays its exit animation. The parent should unmount the section once `onExitComplete` fires. */
  isLeaving?: boolean;
  /** Called when the section exit animation finishes so the parent can safely unmount. */
  onExitComplete?: () => void;
  /** Accessible label for the "previous page" button. Default: 'Previous page'. */
  prevPageAriaLabel?: string;
  /** Accessible label for the "next page" button. Default: 'Next page'. */
  nextPageAriaLabel?: string;
  /** Accessible label for the star button when the item is not starred. Default: 'Add to favorites'. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: 'Remove from favorites'. */
  removeFromFavoritesAriaLabel?: string;
}
