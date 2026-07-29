import { useEffect, useState } from 'react';

/** Return value of {@link useDelayedUnmount}. */
export interface DelayedUnmountState {
  /** Whether the element should still be rendered (including mid exit-animation). */
  shouldRender: boolean;
  /** Whether the element is currently playing its exit animation. */
  isExiting: boolean;
  /** Monotonically increasing counter that increments every time the element transitions from hidden to visible. */
  instanceKey: number;
}

/**
 * Keeps a conditionally-rendered element mounted for `exitDurationMs` after
 * `isVisible` turns `false`, so a CSS exit animation can play to completion.
 * Cancels the pending unmount if `isVisible` turns `true` again mid-exit.
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
