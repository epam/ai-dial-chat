import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CatalogScrollToTopOptions,
  CatalogScrollToTopResult,
} from '../../models/scroll-to-top';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getScrollBehavior = (): ScrollBehavior =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches
    ? 'auto'
    : 'smooth';

/**
 * Tracks whether the catalog is scrolled down by at least one screen — the
 * scroll body plus, in list view, the grid's own rows — so a "Scroll to top"
 * control is offered only once the search field is far away, and returns the
 * action that brings both back to the top and focuses search.
 */
export const useCatalogScrollToTop = ({
  scrollBody,
  searchInputRef,
  listViewRef,
  isListView,
}: CatalogScrollToTopOptions): CatalogScrollToTopResult => {
  const [isVisible, setIsVisible] = useState(false);
  const rowsTopRef = useRef(0);
  const isListViewRef = useRef(isListView);
  const frameRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (!scrollBody) return;
    const rowsTop = isListViewRef.current ? rowsTopRef.current : 0;
    // setState bails out when the boolean is unchanged, so no per-frame render.
    setIsVisible(
      scrollBody.scrollTop + rowsTop >= scrollBody.clientHeight &&
        scrollBody.clientHeight > 0,
    );
  }, [scrollBody]);

  const scheduleRecompute = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      recompute();
    });
  }, [recompute]);

  useEffect(() => {
    /* The hidden grid reports no scroll when shown again, so an offset kept
       from before would surface the control with nothing scrolled. */
    if (!isListView) rowsTopRef.current = 0;
    isListViewRef.current = isListView;
    recompute();
  }, [isListView, recompute]);

  useEffect(() => {
    if (!scrollBody) return;
    scrollBody.addEventListener('scroll', scheduleRecompute, { passive: true });

    return () => {
      scrollBody.removeEventListener('scroll', scheduleRecompute);
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scrollBody, scheduleRecompute]);

  const handleRowsScroll = useCallback(
    (top: number) => {
      if (!isListViewRef.current) return;
      rowsTopRef.current = top;
      scheduleRecompute();
    },
    [scheduleRecompute],
  );

  const scrollToTop = useCallback(() => {
    scrollBody?.scrollTo({ top: 0, behavior: getScrollBehavior() });
    if (isListViewRef.current) {
      listViewRef.current?.scrollToTop();
    }
    /* Focus moves before the button unmounts, so keyboard focus never drops to
       the page body; `preventScroll` keeps it from fighting the smooth scroll. */
    searchInputRef.current?.focus({ preventScroll: true });
  }, [scrollBody, listViewRef, searchInputRef]);

  return { isVisible, handleRowsScroll, scrollToTop };
};
