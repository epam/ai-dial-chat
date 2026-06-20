import { type RefObject, useEffect, useRef, useState } from 'react';
import { CARD_ROW_HEIGHT } from '../constants/virtual-grid';
import { getColumnCount } from './card-grid';

interface VirtualizerState {
  startRow: number;
  endRow: number;
  columnCount: number;
}

/** Returns the nearest scrollable ancestor, falling back to `<html>`. */
const getScrollParent = (el: Element | null): Element => {
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

/** Return value of `useScrollVirtualizer`. */
export interface ScrollVirtualizerResult {
  /** Attach to the container element that wraps all rows. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Index of the first row to render (inclusive). */
  startRow: number;
  /** Index of the last row to render (exclusive). */
  endRow: number;
  /** Number of cards per row derived from the container width. */
  columnCount: number;
  /** Total number of rows for all items. */
  rowCount: number;
  /** Total pixel height of the full (un-windowed) content area. */
  totalHeight: number;
}

/**
 * Virtualizes a card grid whose scroll is driven by the nearest scrollable
 * ancestor rather than an internal scroll container.
 *
 * Attach `containerRef` to a `position: relative` wrapper that has
 * `height: totalHeight` so the page scroll height stays correct.
 * Only rows between `startRow` (inclusive) and `endRow` (exclusive)
 * need to be rendered.
 */
export const useScrollVirtualizer = (
  itemCount: number,
  overscan = 3,
): ScrollVirtualizerResult => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<VirtualizerState>(() => {
    const cols = getColumnCount(
      typeof window !== 'undefined' ? window.innerWidth : 1440,
    );
    const rows = Math.ceil(itemCount / cols);
    return { startRow: 0, endRow: Math.min(rows, 12), columnCount: cols };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollEl = getScrollParent(container.parentElement);

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const scrollElRect = scrollEl.getBoundingClientRect();
      const viewportHeight = scrollEl.clientHeight;
      const containerWidth = container.clientWidth;

      const cols = getColumnCount(containerWidth);
      const rows = Math.ceil(itemCount / cols);

      // Pixels of the container that have scrolled above the viewport top.
      const scrolledPast = Math.max(0, scrollElRect.top - containerRect.top);
      const startRow = Math.max(0, Math.floor(scrolledPast / CARD_ROW_HEIGHT) - overscan);
      const endRow = Math.min(
        rows,
        startRow + Math.ceil(viewportHeight / CARD_ROW_HEIGHT) + 2 * overscan,
      );

      setState({ startRow, endRow, columnCount: cols });
    };

    scrollEl.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();

    return () => {
      scrollEl.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [itemCount, overscan]);

  const rowCount = Math.ceil(itemCount / state.columnCount);

  return {
    containerRef,
    startRow: state.startRow,
    endRow: state.endRow,
    columnCount: state.columnCount,
    rowCount,
    totalHeight: rowCount * CARD_ROW_HEIGHT,
  };
};
