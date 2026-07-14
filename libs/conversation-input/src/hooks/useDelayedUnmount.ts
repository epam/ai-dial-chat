import { useEffect, useState } from 'react';

/** Return value of {@link useDelayedUnmount}. */
export interface DelayedUnmountState {
  /** Whether the element should still be rendered (including mid exit-animation). */
  shouldRender: boolean;
  /** Whether the element is currently playing its exit animation. */
  isExiting: boolean;
  /**
   * Increments every time the element (re)appears. Pass as the rendered
   * element's `key` so React remounts it on a fresh DOM node instead of
   * toggling `isExiting` in place — relying on a CSS `animation-name` change
   * to restart cleanly mid-animation is exactly the kind of transition that
   * can drop a stray unstyled frame in some browsers, e.g. if visibility is
   * toggled back to `true` while the exit animation is still playing.
   */
  instanceKey: number;
}

/**
 * Keeps a conditionally-rendered element mounted for `exitDurationMs` after
 * `isVisible` turns `false`, so a CSS exit animation can play before the
 * caller actually removes it from the tree. `isVisible` turning back to
 * `true` mid-exit cancels the pending unmount and bumps `instanceKey` so the
 * caller remounts fresh rather than resuming the same DOM node.
 */
export const useDelayedUnmount = (
  isVisible: boolean,
  exitDurationMs: number,
): DelayedUnmountState => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isExiting, setIsExiting] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsExiting(false);
      setInstanceKey((key) => key + 1);
      return undefined;
    }
    if (!shouldRender) return undefined;

    setIsExiting(true);
    const timeoutId = setTimeout(() => {
      setShouldRender(false);
      setIsExiting(false);
    }, exitDurationMs);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, exitDurationMs]);

  return { shouldRender, isExiting, instanceKey };
};
