import { useCallback, useLayoutEffect, useRef } from 'react';

const DISCOVERY_RETRY_DELAY_MS = 2_000;
const DISCOVERY_RETRY_COUNT = 5;

interface DiscoverySession {
  pending: Map<string, number>;
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  retired: boolean;
}

/** Inputs for a session-scoped discovery retry loop. */
export interface UseConversationDiscoveryOptions {
  /** Current complete listing. */
  items: readonly { id: string }[];
  /** Refreshes the listing. Initial failures propagate to the caller. */
  refresh: () => Promise<void>;
  /** Opaque identity; changing it retires all previous work. */
  sessionKey: unknown;
  /** Converts host IDs to a comparable identity. */
  normalizeId: (id: string) => string;
  /** Receives retry failures for the current session. */
  onError?: (error: unknown) => void;
  /** Additional retries per missing ID. Defaults to five. */
  retryCount?: number;
  /** Delay after settlement, in milliseconds. Defaults to 2000. */
  retryDelayMs?: number;
}
/** Refreshes expected conversations using one bounded retry loop per session. */
export const useConversationDiscovery = ({
  items: conversations,
  refresh,
  sessionKey,
  normalizeId,
  onError,
  retryCount = DISCOVERY_RETRY_COUNT,
  retryDelayMs = DISCOVERY_RETRY_DELAY_MS,
}: UseConversationDiscoveryOptions): ((
  expectedIds?: readonly string[],
) => Promise<void>) => {
  const sessionRef = useRef<DiscoverySession | null>(null);
  const knownIdsRef = useRef(new Set<string>());

  useLayoutEffect(() => {
    const session: DiscoverySession = {
      pending: new Map(),
      inFlight: false,
      retired: false,
    };
    sessionRef.current = session;
    return () => {
      session.retired = true;
      clearTimeout(session.timer);
    };
  }, [sessionKey]);

  useLayoutEffect(() => {
    knownIdsRef.current = new Set(
      conversations.map(({ id }) => normalizeId(id)),
    );
  }, [conversations, normalizeId]);

  const scheduleDiscovery = useCallback(
    (session: DiscoverySession) => {
      const prunePending = () => {
        for (const [id, remaining] of session.pending) {
          if (knownIdsRef.current.has(id) || remaining === 0) {
            session.pending.delete(id);
          }
        }
      };
      const scheduleNext = () => {
        prunePending();
        if (
          session.retired ||
          session.timer ||
          session.inFlight ||
          session.pending.size === 0
        )
          return;
        session.timer = setTimeout(() => {
          session.timer = undefined;
          void retry();
        }, retryDelayMs);
      };
      const retry = async () => {
        prunePending();
        if (session.retired || session.pending.size === 0) return;
        for (const [id, remaining] of session.pending) {
          session.pending.set(id, remaining - 1);
        }
        session.inFlight = true;
        try {
          await refresh();
        } catch (error) {
          if (!session.retired) onError?.(error);
        } finally {
          session.inFlight = false;
          scheduleNext();
        }
      };
      scheduleNext();
    },
    [refresh, onError, retryDelayMs],
  );

  return useCallback(
    async (expectedIds: readonly string[] = []) => {
      const session = sessionRef.current;
      if (!session || session.retired) return;
      for (const rawId of expectedIds) {
        const id = normalizeId(rawId);
        if (!knownIdsRef.current.has(id) && !session.pending.has(id)) {
          session.pending.set(id, retryCount);
        }
      }
      await refresh();
      scheduleDiscovery(session);
    },
    [refresh, scheduleDiscovery, normalizeId, retryCount],
  );
};
