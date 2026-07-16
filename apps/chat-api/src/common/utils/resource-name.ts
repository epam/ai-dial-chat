/**
 * Human-readable name derived from a DIAL Core resource id (e.g.
 * `toolsets/public/shn/shn-notion__1.0.0`) — the last path segment, since
 * ids are full storage paths and only that segment reads as a name.
 */
export const getResourceDisplayNameFallback = (id: string): string =>
  id.split('/').pop()?.trim() || id.trim();
