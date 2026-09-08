import type { RefObject, UIEventHandler } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const OVERFLOW_TOLERANCE = 1;

/** Return value of `useHorizontalOverflow`. */
export interface UseHorizontalOverflowResult<TContent extends HTMLElement> {
  /** Ref attached to the horizontally scrollable container. */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Ref attached to the content element whose visible bounds are measured. */
  contentRef: RefObject<TContent | null>;
  /** Whether content remains beyond the logical start of the viewport. */
  hasContentBeyondStart: boolean;
  /** Whether content remains beyond the logical end of the viewport. */
  hasContentBeyondEnd: boolean;
  /** Re-measures the visible content bounds after horizontal scrolling. */
  handleScroll: UIEventHandler<HTMLDivElement>;
}

/**
 * Tracks whether horizontally scrollable content extends past either logical
 * edge of its container, so a caller can render direction-aware affordances
 * (edge fades, a focusable scroll region) only while scrolling is possible.
 */
export const useHorizontalOverflow = <
  TContent extends HTMLElement,
>(): UseHorizontalOverflowResult<TContent> => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<TContent>(null);
  const [hasContentBeyondStart, setHasContentBeyondStart] = useState(false);
  const [hasContentBeyondEnd, setHasContentBeyondEnd] = useState(false);

  const measureContentBounds = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;

    if (!scrollContainer || !content) return;

    const hasOverflow =
      scrollContainer.scrollWidth - scrollContainer.clientWidth >
      OVERFLOW_TOLERANCE;
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const isRtl = getComputedStyle(scrollContainer).direction === 'rtl';
    const contentExtendsBeyondStart = isRtl
      ? contentRect.right > scrollContainerRect.right + OVERFLOW_TOLERANCE
      : contentRect.left < scrollContainerRect.left - OVERFLOW_TOLERANCE;
    const contentExtendsBeyondEnd = isRtl
      ? contentRect.left < scrollContainerRect.left - OVERFLOW_TOLERANCE
      : contentRect.right > scrollContainerRect.right + OVERFLOW_TOLERANCE;

    setHasContentBeyondStart(hasOverflow && contentExtendsBeyondStart);
    setHasContentBeyondEnd(hasOverflow && contentExtendsBeyondEnd);
  }, []);

  useLayoutEffect(() => {
    measureContentBounds();

    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;

    if (!scrollContainer || !content || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(measureContentBounds);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [measureContentBounds]);

  return {
    scrollContainerRef,
    contentRef,
    hasContentBeyondStart,
    hasContentBeyondEnd,
    handleScroll: measureContentBounds,
  };
};
