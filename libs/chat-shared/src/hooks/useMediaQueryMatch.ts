import { useCallback, useSyncExternalStore } from 'react';

const canMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const getServerSnapshot = (): boolean => false;

/*
 * Reads the query at render time through `useSyncExternalStore`, so every
 * breakpoint hook used in one component agrees within a single render. With
 * per-hook state, `useIsMobile` and `useIsTablet` updated in separate renders
 * on a breakpoint crossing, and the intermediate render (mobile but not
 * tablet) remounted the sources panel content (issue #9907).
 */
/** Returns whether `query` currently matches, re-rendering when the match changes. */
export const useMediaQueryMatch = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!canMatchMedia()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => canMatchMedia() && window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
