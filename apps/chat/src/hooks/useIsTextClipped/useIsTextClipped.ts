import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/* Sub-pixel layout rounding makes scrollWidth exceed clientWidth by a fraction
   on text that is not actually clipped, so a whole pixel is the threshold. */
const CLIPPING_TOLERANCE = 1;

/** Return value of `useIsTextClipped`. */
export interface UseIsTextClippedResult<TElement extends HTMLElement> {
  /** Ref attached to the element whose text may be clipped. */
  ref: RefObject<TElement | null>;
  /** Whether the element's text overflows its box horizontally. */
  isClipped: boolean;
}

/**
 * Reports whether an element's text overflows horizontally, so a caller can
 * offer a way to reveal the hidden part only when something is actually
 * hidden.
 *
 * `isMeasuring` exists because the answer is only meaningful while the element
 * is in its clipped state: once the caller lets the text wrap, nothing
 * overflows any more, and re-measuring there would retract the very control
 * the reader just used. The last measurement taken while clipped is kept
 * instead.
 *
 * @param isMeasuring - Whether the element is currently in its clipped state.
 * @param contentKey - Text whose change should force a re-measure. A
 *   ResizeObserver does not fire for it: clipped text keeps the same box when
 *   its content grows.
 */
export const useIsTextClipped = <TElement extends HTMLElement>(
  isMeasuring: boolean,
  contentKey: string,
): UseIsTextClippedResult<TElement> => {
  const ref = useRef<TElement>(null);
  const [isClipped, setIsClipped] = useState(false);

  const measure = useCallback(() => {
    const element = ref.current;

    if (!element) return;

    setIsClipped(
      element.scrollWidth - element.clientWidth > CLIPPING_TOLERANCE,
    );
  }, []);

  useLayoutEffect(() => {
    if (!isMeasuring) return;

    measure();

    const element = ref.current;

    if (!element || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [isMeasuring, contentKey, measure]);

  return { ref, isClipped };
};
