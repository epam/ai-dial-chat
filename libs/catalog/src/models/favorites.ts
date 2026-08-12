import { CatalogItem } from './catalog-item';

/** Typography class overrides for `CatalogFavorites`. */
export interface FavoritesTypography {
  /** Typography class for the section title. Default: `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class for the total count and the page counter. Default: `'dial-tiny-semi-text'`. */
  countClassName?: string;
}

/** Color overrides for `CatalogFavorites`, applied via CSS custom properties. */
export interface FavoritesColors {
  /** Section title color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Total-count and page-counter text color. Fallback: `--text-secondary`. */
  countText?: string;
  /** Color of the checkmark icon on the selected favorite card. Fallback: `--text-accent`. */
  selectedCheckIcon?: string;
  /** Border color of the selected favorite card. Fallback: `--stroke-info`. */
  selectedCardBorder?: string;
  /** Background color (tint) of the selected favorite card. Fallback: `--bg-accent-primary-alpha`. */
  selectedCardBackground?: string;
  /** Icon color of the pagination arrows. Fallback: `--text-accent`. */
  navButton?: string;
  /** Icon color of a disabled pagination arrow. Fallback: `--stroke-secondary`. */
  navButtonDisabled?: string;
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
  /** ID of an item to visually mark as selected (border, tint, and checkmark). */
  selectedItemId?: string;
  /** Credentials-status badge label shown when a favorited item is signed out. Default: `'LOGGED OUT'`. */
  credentialsBadgeLoggedOutLabel?: string;
}
