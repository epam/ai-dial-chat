import { useCallback, useLayoutEffect, useRef } from 'react';
import { toPanelConversationId } from '../../utils/conversation-id-match';

const DISCOVERY_RETRY_DELAY_MS = 2_000;
const DISCOVERY_RETRY_COUNT = 5;

interface DiscoverySession {
  pending: Map<string, number>;
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  retired: boolean;
}

/**
 * Keeps expected chats discoverable after run polling or the task page stops.
 * Owned by the conversations provider: retries share one timer and survive
 * navigation, but stop on discovery, budget exhaustion, or identity change.
 * The supplied refresh handles request errors in the provider.
 */
export const useConversationDiscovery = (
  conversations: readonly { id: string }[],
  refresh: () => Promise<void>,
  userSub: string | undefined,
): ((expectedIds?: readonly string[]) => Promise<void>) => {
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
  }, [userSub]);

  useLayoutEffect(() => {
    knownIdsRef.current = new Set(
      conversations.map(({ id }) => toPanelConversationId(id)),
    );
  }, [conversations]);

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
        }, DISCOVERY_RETRY_DELAY_MS);
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
        } finally {
          session.inFlight = false;
          scheduleNext();
        }
      };
      scheduleNext();
    },
    [refresh],
  );

  return useCallback(
    async (expectedIds: readonly string[] = []) => {
      const session = sessionRef.current;
      if (!session || session.retired) return;
      for (const rawId of expectedIds) {
        const id = toPanelConversationId(rawId);
        if (!knownIdsRef.current.has(id) && !session.pending.has(id)) {
          session.pending.set(id, DISCOVERY_RETRY_COUNT);
        }
      }
      await refresh();
      scheduleDiscovery(session);
    },
    [refresh, scheduleDiscovery],
  );
};
