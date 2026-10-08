import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const OVERFLOW_TOLERANCE = 1;

/** Return value of `useIsVerticallyClamped`. */
export interface UseIsVerticallyClampedResult<TElement extends HTMLElement> {
  /** Ref attached to the clamped element whose overflow is measured. */
  ref: RefObject<TElement | null>;
  /** Whether the element's content is taller than its visible box. */
  isClamped: boolean;
}

/**
 * Tracks whether a `line-clamp-*` (or any `overflow: hidden`) element hides
 * part of its content, so a caller can reveal the rest — e.g. in a tooltip —
 * only when something is actually cut off. Re-measures on every resize of the
 * element and whenever `content` changes.
 */
export const useIsVerticallyClamped = <TElement extends HTMLElement>(
  content: unknown,
): UseIsVerticallyClampedResult<TElement> => {
  const ref = useRef<TElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    setIsClamped(
      element.scrollHeight - element.clientHeight > OVERFLOW_TOLERANCE,
    );
  }, []);

  useLayoutEffect(() => {
    measure();

    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [measure, content]);

  return { ref, isClamped };
};
