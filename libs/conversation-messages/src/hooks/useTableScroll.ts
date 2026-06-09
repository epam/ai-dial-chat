import type { RefObject, UIEventHandler } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const OVERFLOW_TOLERANCE = 1;

export interface UseTableScrollResult {
  /** Ref attached to the horizontally scrollable table container. */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Ref attached to the table whose visible bounds are measured. */
  tableRef: RefObject<HTMLTableElement | null>;
  /** Whether table content remains beyond the logical start of the viewport. */
  hasContentBeyondStart: boolean;
  /** Whether table content remains beyond the logical end of the viewport. */
  hasContentBeyondEnd: boolean;
  /** Re-measures the visible table bounds after horizontal scrolling. */
  handleScroll: UIEventHandler<HTMLDivElement>;
}

/** Tracks whether a horizontally scrollable table has content beyond its logical end. */
export const useTableScroll = (): UseTableScrollResult => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [hasContentBeyondStart, setHasContentBeyondStart] = useState(false);
  const [hasContentBeyondEnd, setHasContentBeyondEnd] = useState(false);

  const measureContentBounds = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const table = tableRef.current;

    if (!scrollContainer || !table) return;

    const hasOverflow =
      scrollContainer.scrollWidth - scrollContainer.clientWidth >
      OVERFLOW_TOLERANCE;
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const isRtl = getComputedStyle(scrollContainer).direction === 'rtl';
    const contentExtendsBeyondStart = isRtl
      ? tableRect.right > scrollContainerRect.right + OVERFLOW_TOLERANCE
      : tableRect.left < scrollContainerRect.left - OVERFLOW_TOLERANCE;
    const contentExtendsBeyondEnd = isRtl
      ? tableRect.left < scrollContainerRect.left - OVERFLOW_TOLERANCE
      : tableRect.right > scrollContainerRect.right + OVERFLOW_TOLERANCE;

    setHasContentBeyondStart(hasOverflow && contentExtendsBeyondStart);
    setHasContentBeyondEnd(hasOverflow && contentExtendsBeyondEnd);
  }, []);

  useLayoutEffect(() => {
    measureContentBounds();

    const scrollContainer = scrollContainerRef.current;
    const table = tableRef.current;

    if (!scrollContainer || !table || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(measureContentBounds);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(table);

    return () => resizeObserver.disconnect();
  }, [measureContentBounds]);

  return {
    scrollContainerRef,
    tableRef,
    hasContentBeyondStart,
    hasContentBeyondEnd,
    handleScroll: measureContentBounds,
  };
};
