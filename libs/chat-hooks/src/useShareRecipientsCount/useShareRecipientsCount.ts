import type { ShareApi } from '@epam/ai-dial-chat-api-client';
import { useCallback, useRef, useState } from 'react';

/** Lifecycle of an on-demand recipient-count lookup for one resource. */
export enum RecipientsCountStatus {
  /** Nothing requested yet for this resource. */
  Idle = 'idle',
  /** A lookup is in flight. */
  Loading = 'loading',
  /** A count came back and is known exactly. */
  Resolved = 'resolved',
  /** The lookup failed, so the count is unknown. */
  Unknown = 'unknown',
}

/** State of one resource's recipient-count lookup. */
export interface RecipientsCountEntry {
  /** Where the lookup for this resource currently stands. */
  status: RecipientsCountStatus;
  /** Number of users holding access; present only once the status is `Resolved`. */
  count?: number;
}

/** Per-resource recipient-count lookups resolved on demand. */
export interface UseShareRecipientsCountResult {
  /** Starts a lookup for the resource unless one already ran for it. */
  requestRecipientsCount: (itemId: string) => void;
  /** Current lookup state for the resource. */
  getRecipientsCount: (itemId: string) => RecipientsCountEntry;
  /** Drops the resource's cached result so the next request fetches it again. */
  invalidateRecipientsCount: (itemId: string) => void;
}

const IDLE_ENTRY: RecipientsCountEntry = {
  status: RecipientsCountStatus.Idle,
};

/**
 * Resolves how many users hold shared access to a resource, one resource at
 * a time and only when asked. Accepts an already-configured `ShareApi`
 * instance — this hook owns only the dedup/cache state machine, not the
 * client's base URL, auth, or CSRF setup.
 */
export const useShareRecipientsCount = (
  shareApi: Pick<ShareApi, 'getShareRecipientsCount'>,
): UseShareRecipientsCountResult => {
  const [entries, setEntries] = useState<
    Record<string, RecipientsCountEntry | undefined>
  >({});
  /* Ids whose lookup has already been started, so reopening the same menu does
   * not re-issue the request. */
  const requestedIdsRef = useRef(new Set<string>());

  const requestRecipientsCount = useCallback(
    (itemId: string) => {
      if (requestedIdsRef.current.has(itemId)) return;
      requestedIdsRef.current.add(itemId);
      setEntries((prev) => ({
        ...prev,
        [itemId]: { status: RecipientsCountStatus.Loading },
      }));

      const resolve = async () => {
        try {
          const { recipientsCount } = await shareApi.getShareRecipientsCount({
            itemId,
          });
          setEntries((prev) => ({
            ...prev,
            [itemId]: {
              status: RecipientsCountStatus.Resolved,
              count: recipientsCount,
            },
          }));
        } catch {
          /* An unresolved count must not remove the only way to revoke, so the
           * action stays reachable — just without a number. */
          setEntries((prev) => ({
            ...prev,
            [itemId]: { status: RecipientsCountStatus.Unknown },
          }));
        }
      };
      void resolve();
    },
    [shareApi],
  );

  const getRecipientsCount = useCallback(
    (itemId: string) => entries[itemId] ?? IDLE_ENTRY,
    [entries],
  );

  const invalidateRecipientsCount = useCallback((itemId: string) => {
    requestedIdsRef.current.delete(itemId);
    setEntries(({ [itemId]: _removed, ...rest }) => rest);
  }, []);

  return {
    requestRecipientsCount,
    getRecipientsCount,
    invalidateRecipientsCount,
  };
};
