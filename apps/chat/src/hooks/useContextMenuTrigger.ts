import { useCallback, useEffect, useRef } from 'react';

const PRESS_THRESHOLD = 500;

/**
 * A custom hook that enables context menu triggering for a given element
 *
 * @param cb - A callback function to be invoked when the context menu is triggered.
 * @param ref - A React ref object pointing to the target HTML element where the context menu trigger should be applied.
 *
 * @remarks
 * - The hook listens for `contextmenu` events for mouse interactions.
 * - For touch interactions, it listens for `touchstart` and `touchend` events to detect long-press gestures.
 * - The `PRESS_THRESHOLD` constant (not defined in this snippet) determines the duration required for a long-press to trigger the context menu.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useContextMenuTrigger((e) => {
 *   console.log('Context menu triggered', e);
 * }, ref);
 *
 * return <div ref={ref}>Right-click or long-press me</div>;
 * ```
 */
export const useContextMenuTrigger = (
  cb: (e: MouseEvent | TouchEvent) => void,
  ref: React.RefObject<HTMLElement>,
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const timer = useRef<number | null>(null);

  const handleContextMenuEvent = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      cb(e);
    },
    [cb],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      e.stopPropagation();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timer.current = new Date().valueOf();
      timeoutRef.current = setTimeout(() => cb(e), PRESS_THRESHOLD);
    },
    [cb],
  );

  const handleTouchEnd = useCallback(() => {
    if (
      timer.current &&
      new Date().valueOf() - timer.current < PRESS_THRESHOLD
    ) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('contextmenu', handleContextMenuEvent);
    element.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('contextmenu', handleContextMenuEvent);
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handleContextMenuEvent, handleTouchStart, handleTouchEnd]);
};
