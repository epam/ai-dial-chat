import type { CatalogItem } from './catalog-item';

/** Text overrides for `CatalogCardGrid` empty state. */
export interface CatalogCardGridTitles {
  /** Empty-state heading text. Default: `'No results'`. */
  noResultsTitle?: string;
  /** Label for the "Featured" tag on cards. Default: `'Featured'`. */
  featuredLabel?: string;
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
}
