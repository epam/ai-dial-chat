import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const OVERFLOW_TOLERANCE = 1;

/** Return value of `useIsVerticallyClamped`. */
export interface UseIsVerticallyClampedResult<TElement extends HTMLElement> {
  /** Ref attached to the clamped element whose overflow is measured. */
  ref: RefObject<TElement | null>;
  /** Whether the element, or one of its direct children, is taller inside than its visible box. */
  isClamped: boolean;
}

const isOverflowing = (element: Element): boolean =>
  element.scrollHeight - element.clientHeight > OVERFLOW_TOLERANCE;

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

    /*
     * The clamp can land on a child instead of the element itself: a wrapped
     * component that clamps its own text (the kit's `Highlight` does) leaves
     * the wrapper exactly as tall as the clipped child, so only the child
     * reports the overflow (#9400).
     */
    setIsClamped(
      isOverflowing(element) ||
        Array.from(element.children).some(isOverflowing),
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
