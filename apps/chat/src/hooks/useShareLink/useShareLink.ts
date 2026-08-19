import type { CreateShareLinkDtoResourceKindEnum } from '@epam/ai-dial-chat-api-client';
import { ShareLinkAccess, ShareLinkData } from '@epam/ai-dial-share';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getShareLink } from '../../utils/share-link';

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

/**
 * Resolves and manages share-link data for a catalog entity.
 *
 * Backed by `getShareLink` — a single swappable seam. Swapping the mock
 * implementation for a real API call only touches that function; this hook's
 * public shape (and every consumer of it) stays the same.
 */
export const useShareLink = (
  itemId: string,
  resourceKind?: CreateShareLinkDtoResourceKindEnum,
): UseShareLinkResult => {
  const [data, setData] = useState<ShareLinkData>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  /*
   * Access is not merely display state: DIAL Core issues a distinct link per
   * access level, so changing it re-POSTs for a fresh link rather than
   * patching the previous response in place.
   */
  const load = useCallback(
    async (access?: ShareLinkAccess[]) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const result = await getShareLink(
          itemId,
          access,
          window.location.origin,
          resourceKind,
        );
        if (requestIdRef.current === requestId) setData(result);
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
    [itemId, resourceKind],
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
