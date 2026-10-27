import type { RefObject } from 'react';
import type { ListViewHandle } from './list-props';

/** Options for `useCatalogScrollToTop`. */
export interface CatalogScrollToTopOptions {
  /** The scrollable element holding the catalog content, or `null` until it mounts. */
  scrollBody: HTMLElement | null;
  /** The search input that receives focus after scrolling to the top. */
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** Handle of the list view, whose rows scroll inside their own box. */
  listViewRef: RefObject<ListViewHandle | null>;
  /** Whether the list view is the active view mode. */
  isListView: boolean;
}

/** Return value of `useCatalogScrollToTop`. */
export interface CatalogScrollToTopResult {
  /** Whether the user has scrolled down by at least one scroll-body height. */
  isVisible: boolean;
  /** Records the list rows' vertical scroll offset in pixels. */
  handleRowsScroll: (top: number) => void;
  /** Scrolls the scroll body and the list rows to the top, then focuses search. */
  scrollToTop: () => void;
}
