import type { CatalogItem } from './catalog-item';

/** Text overrides for `CardGrid` empty state. */
export interface CardGridTitles {
  /** Empty-state heading text. Default: `'No results'`. */
  noResultsTitle?: string;
  /** Label for the "Featured" tag on cards. Default: `'Featured'`. */
  featuredLabel?: string;
}

/** Props for `CardGrid`. */
export interface CardGridProps {
  /** Items to display in the 3-column grid. */
  items: CatalogItem[];
  /** Active search query forwarded to each `Card` for highlighting. */
  query?: string;
  /** Called when a card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Grouped empty-state text overrides. */
  titles?: CardGridTitles;
  /** Called when a card body is clicked. */
  onItemClick?: (item: CatalogItem) => void;
}
