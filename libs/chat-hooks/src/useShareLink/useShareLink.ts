import {
  ShareLinkResponseDtoAccessEnum,
  type CreateShareLinkDtoResourceKindEnum,
  type ShareApi,
} from '@epam/ai-dial-chat-api-client';
import { ShareLinkAccess, ShareLinkData } from '@epam/ai-dial-share';
import { useCallback, useEffect, useRef, useState } from 'react';

const toShareLinkAccess = (
  access: ShareLinkResponseDtoAccessEnum[],
): ShareLinkAccess[] =>
  access.map((level) =>
    level === ShareLinkResponseDtoAccessEnum.Edit
      ? ShareLinkAccess.Edit
      : ShareLinkAccess.View,
  );

/** Result returned by {@link useShareLink}. */
export interface UseShareLinkResult {
  /** Resolved share-link data, or `undefined` while loading or on error. */
  data: ShareLinkData | undefined;
  /** Whether the share link is still being created. */
  isLoading: boolean;
  /** Set when the share link could not be created. */
  error: Error | null;
  /** Requests a new share link for the given access levels. */
  setAccess: (access: ShareLinkAccess[]) => void;
}

/*
 * DIAL Core resolves `url` against its own configured host, which does not
 * always match the origin the frontend is actually being served from (e.g.
 * local dev runs the API and the SPA on different ports). Re-anchoring the
 * path to the caller's origin keeps the displayed/copied link pointing at
 * the host the user is on.
 */
const withOrigin = (url: string, origin: string): string => {
  const resolved = new URL(url, origin);
  return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
};

/**
 * Resolves and manages share-link data for a DIAL Core resource.
 *
 * Accepts an already-configured `ShareApi` instance — this hook owns only
 * the request lifecycle (loading/error, a stale-response guard, and
 * re-fetch on access change), not the client's base URL, auth, or CSRF
 * setup, which stay the caller's responsibility.
 */
export const useShareLink = (
  shareApi: Pick<ShareApi, 'createShareLink'>,
  itemId: string,
  resourceKind?: CreateShareLinkDtoResourceKindEnum,
  origin: string = window.location.origin,
): UseShareLinkResult => {
  const [data, setData] = useState<ShareLinkData>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  /*
   * Access is not merely display state: DIAL Core issues a distinct link per
   * access level, so changing it re-requests a fresh link rather than
   * patching the previous response in place.
   */
  const load = useCallback(
    async (access: ShareLinkAccess[] = [ShareLinkAccess.View]) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const response = await shareApi.createShareLink({
          createShareLinkDto: { itemId, resourceKind, access },
        });
        if (requestIdRef.current === requestId) {
          setData({
            url: withOrigin(response.url, origin),
            expiresInDays: response.expiresInDays,
            access: toShareLinkAccess(response.access),
          });
        }
      } catch (err) {
        if (requestIdRef.current === requestId) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to create share link'),
          );
        }
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [itemId, origin, resourceKind, shareApi],
  );

  useEffect(() => {
    setData(undefined);
    void load();
  }, [itemId, load]);

  const setAccess = useCallback(
    (access: ShareLinkAccess[]) => {
      void load(access);
    },
    [load],
  );

  return { data, isLoading, error, setAccess };
};
