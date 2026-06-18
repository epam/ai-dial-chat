import type { CatalogItem } from './CatalogItem';

/** Text overrides for `CatalogCardGrid` empty state. */
export interface CatalogCardGridTitles {
  /** Empty-state heading text. Default: `'No results'`. */
  noResultsTitle?: string;
  /** Empty-state description text. Default: `'Try a different keyword'`. */
  noResultsDescription?: string;
}

/** Class-name overrides for `CatalogCardGrid` empty state elements. */
export interface CatalogCardGridStyles {
  /** Typography class for the empty-state heading. Default: `'dial-h3-text'`. */
  noResultsTitleClassName?: string;
  /** Typography class for the empty-state description. Default: `'dial-small-text'`. */
  noResultsDescriptionClassName?: string;
}

/** Props for `CatalogCardGrid`. */
export interface CatalogCardGridProps {
  /** Items to display in the 3-column grid. */
  items: CatalogItem[];
  /** Active search query forwarded to each `CatalogCard` for highlighting. */
  query?: string;
  /** Called when a card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Grouped empty-state text overrides. */
  titles?: CatalogCardGridTitles;
  /** Grouped class-name overrides for empty-state elements. */
  styles?: CatalogCardGridStyles;
}
