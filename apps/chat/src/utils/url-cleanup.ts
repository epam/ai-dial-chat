/**
 * Reads the router state currently stored for this history entry, so a cleanup
 * that only drops query keys can hand it back unchanged.
 */
export const getCurrentRouterState = (): unknown =>
  (window.history.state as { usr?: unknown } | null)?.usr ?? null;
