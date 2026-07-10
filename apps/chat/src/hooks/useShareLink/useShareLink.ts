import { useCallback, useEffect, useState } from 'react';
import { ShareLinkAccess, ShareLinkData } from '../../types/share';
import { getShareLink } from '../../utils/share-link';

/** Result returned by {@link useShareLink}. */
export interface UseShareLinkResult {
  /** Resolved share-link data, or `undefined` while loading or on error. */
  data: ShareLinkData | undefined;
  /** Whether the share link is still being created. */
  isLoading: boolean;
  /** Set when the share link could not be created. */
  error: Error | null;
  /** Updates the access level granted to anyone with the link. */
  setAccess: (access: ShareLinkAccess) => void;
}

/**
 * Resolves and manages share-link data for a catalog entity.
 *
 * Backed by `getShareLink` — a single swappable seam. Swapping the mock
 * implementation for a real API call only touches that function; this hook's
 * public shape (and every consumer of it) stays the same.
 */
export const useShareLink = (itemId: string): UseShareLinkResult => {
  const [data, setData] = useState<ShareLinkData>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(undefined);

    getShareLink(itemId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to create share link'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const setAccess = useCallback((access: ShareLinkAccess) => {
    setData((prev) => (prev ? { ...prev, access } : prev));
  }, []);

  return { data, isLoading, error, setAccess };
};
