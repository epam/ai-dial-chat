/** Target of a `replace` navigation that keeps the current pathname. */
export interface CleanedLocationTarget {
  /** Query string without the removed keys, including the leading `?` (empty when nothing is left). */
  search: string;
  /** Current hash, unchanged. */
  hash: string;
}

/**
 * Builds the `search` and `hash` for a `replace` navigation that drops `keys`
 * from the query string and leaves everything else as it is right now, byte for
 * byte (the remaining pairs are not re-encoded).
 * Reads `window.location` at call time rather than the router's `useLocation()`:
 * the router applies navigations in a low-priority transition, so a render-time
 * `search` can lag and would bring back a parameter that was just removed.
 * @param keys - query parameter names to remove
 */
export const getCleanedLocationTarget = (
  keys: readonly string[],
): CleanedLocationTarget => {
  const kept = window.location.search
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => {
      if (!pair) return false;
      const rawKey = pair.split('=')[0].replace(/\+/g, ' ');
      try {
        return !keys.includes(decodeURIComponent(rawKey));
      } catch {
        return true;
      }
    });
  return {
    search: kept.length > 0 ? `?${kept.join('&')}` : '',
    hash: window.location.hash,
  };
};

/**
 * Reads the router state currently stored for this history entry, so a cleanup
 * that only drops query keys can hand it back unchanged.
 */
export const getCurrentRouterState = (): unknown =>
  (window.history.state as { usr?: unknown } | null)?.usr ?? null;
