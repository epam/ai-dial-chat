import { useCallback, useEffect, useRef } from 'react';

/** Reports whether the async operation it was begun for has been superseded or its component unmounted. */
export type StaleChecker = () => boolean;

interface StaleGuardState<K> {
  mounted: boolean;
  /** Bumped on every `begin` and every `key` change, so older checks resolve as stale. */
  generation: number;
  key: K;
}

/**
 * Tracks whether an async operation's resolution is still current for the
 * mounting component. A check goes stale when the component unmounts, a newer
 * check begins, or `key` changes — the last because a component often stays
 * mounted across a key change (e.g. a route param identifying the resource
 * the operation targets), where unmount-tracking alone is not enough.
 *
 * Call `begin()` at the start of each async operation and consult the
 * returned checker before applying the operation's result or cleaning up its
 * in-flight state.
 */
export const useStaleGuard = <K>(key: K): (() => StaleChecker) => {
  const stateRef = useRef<StaleGuardState<K>>({
    mounted: true,
    generation: 0,
    key,
  });

  /*
   * The body must restore `mounted: true`, not only flip it to `false` on
   * cleanup: React 19 StrictMode (local dev) runs mount → cleanup → mount,
   * so a cleanup-only effect leaves the guard stale for the component's
   * whole life. A key change bumps the generation so checks begun for the
   * previous key resolve as stale without their own key bookkeeping.
   */
  useEffect(() => {
    /*
     * The ref object is never reassigned, so this local copy is the same
     * object for the effect's whole life — including in the cleanup, where
     * reading `stateRef.current` directly would trip
     * `react-hooks/exhaustive-deps`.
     */
    const state = stateRef.current;
    state.mounted = true;
    state.generation += 1;
    state.key = key;
    return () => {
      state.mounted = false;
    };
  }, [key]);

  const begin = useCallback(() => {
    const generation = (stateRef.current.generation += 1);
    return () => {
      const state = stateRef.current;
      return !state.mounted || state.generation !== generation;
    };
  }, []);

  return begin;
};
