import { type RefObject, useEffect, useRef, useState } from 'react';

/** Returns the nearest scrollable ancestor, falling back to `<html>`. */
export const getScrollParent = (el: Element | null): Element => {
  if (!el || el === document.body) return document.documentElement;
  const { overflow, overflowY } = getComputedStyle(el);
  if (
    overflow === 'auto' ||
    overflow === 'scroll' ||
    overflowY === 'auto' ||
    overflowY === 'scroll'
  ) {
    return el;
  }
  return getScrollParent(el.parentElement);
};

/** Rows kept mounted beyond each edge of the viewport. */
const DEFAULT_OVERSCAN = 10;

/**
 * Rows the window snaps to. An even block keeps `startRow` even, so a table
 * that stripes even rows keeps striping the same absolute rows as the window
 * moves, and the slice stays put while scrolling within one block.
 */
const BLOCK = 10;

/** Rows rendered before anything can be measured — SSR, `display: none`, jsdom. */
const UNMEASURED_ROWS = 30;

/** Row range `useRowWindow` currently wants rendered. */
export interface RowWindow {
  /** Attach to the element that spans all rows, spacers included. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Index of the first row to render (inclusive). */
  startRow: number;
  /** Index of one past the last row to render (exclusive). */
  endRow: number;
}

/**
 * Tracks which slice of a fixed-row-height list covers the viewport of its
 * nearest scrollable ancestor, for a list that scrolls with the page rather
 * than inside its own box.
 */
export const useRowWindow = (
  rowCount: number,
  rowHeight: number,
  overscan = DEFAULT_OVERSCAN,
): RowWindow => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState({ start: 0, end: UNMEASURED_ROWS });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollEl = getScrollParent(container.parentElement);

    const update = () => {
      const viewportHeight = scrollEl.clientHeight;
      /* Hidden or not laid out yet: keep whatever window is already up. */
      if (viewportHeight === 0) return;

      const containerTop = container.getBoundingClientRect().top;
      const viewportTop = scrollEl.getBoundingClientRect().top;
      // Pixels of the list that have scrolled above the viewport's top edge.
      const scrolledPast = Math.max(0, viewportTop - containerTop);

      const firstVisible = Math.floor(scrolledPast / rowHeight);
      const visibleRows = Math.ceil(viewportHeight / rowHeight);

      const start = Math.max(
        0,
        Math.floor((firstVisible - overscan) / BLOCK) * BLOCK,
      );
      const end = Math.min(
        rowCount,
        Math.ceil((firstVisible + visibleRows + overscan) / BLOCK) * BLOCK,
      );

      setRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    };

    scrollEl.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(scrollEl);
    update();

    return () => {
      scrollEl.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [rowCount, rowHeight, overscan]);

  /*
   * The row count can drop (a search, a filter) a render before the effect
   * recomputes from the scroll position, so clamp here rather than letting
   * that one render slice past the end and show nothing.
   */
  const maxStart = Math.max(0, Math.floor((rowCount - 1) / BLOCK) * BLOCK);
  const startRow = Math.min(range.start, maxStart);

  return {
    containerRef,
    startRow,
    endRow: Math.min(rowCount, Math.max(range.end, startRow + BLOCK)),
  };
};
