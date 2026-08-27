import { mapPublishConversationResultDto } from '@epam/ai-dial-chat-hooks';
import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import { useCallback, useRef, useState } from 'react';
import { getConversationPublishHistory } from '../../server-api/conversation-publish.api';
import { PublishHistoryStatus } from '../../types/publish-history';

/** State of one conversation's publish-history lookup. */
export interface PublishHistoryEntryState {
  /** Where the lookup for this conversation currently stands. */
  status: PublishHistoryStatus;
  /** Folders the conversation is published to; present only once the status is `Resolved`. */
  entries?: PublishHistoryEntry[];
}

/** Per-conversation publish-history lookups resolved on demand. */
export interface UseConversationPublishHistoryResult {
  /** Starts a lookup for the conversation unless a fresh one already ran for it. */
  requestPublishHistory: (path: string) => void;
  /** Current lookup state for the conversation. */
  getPublishHistory: (path: string) => PublishHistoryEntryState;
}

const IDLE_ENTRY: PublishHistoryEntryState = {
  status: PublishHistoryStatus.Idle,
};

/*
 * How long a resolved lookup is reused before the next menu open re-issues it.
 * Matches the server-side publish-history cache in
 * `conversation-publish.service.ts`, so a revalidation inside the window is
 * answered from that cache and costs no `getPublications` scan.
 *
 * Deliberately not "once per session": whether a conversation is published
 * changes outside this tab. An administrator approving an unpublish request is
 * exactly that — the folder disappears from history server-side while a cache
 * with no expiry keeps offering Unpublish for a copy Core has deleted, which
 * then fails with "Target resource does not exists"
 * ([GH #8445](https://github.com/epam/ai-dial-chat/issues/8445)).
 */
const PUBLISH_HISTORY_TTL_MS = 60 * 1000;

/**
 * Resolves which folders a conversation is published to, one conversation at a
 * time and only when asked.
 *
 * Never called while rendering the conversation list: the list can hold
 * hundreds of rows and each lookup is a bucket-wide `getPublications` scan on
 * the server, so it runs when a row's action menu is opened or focused. The
 * result gates the row's Unpublish entry — which cannot build a request
 * without a folder — and is handed to the publish panel for the same
 * conversation, so opening both issues one request.
 *
 * A resolved result is reused for `PUBLISH_HISTORY_TTL_MS` and revalidated
 * after that, so a row menu opened later in a long-lived session reflects
 * approvals that happened meanwhile rather than a first-open snapshot. At most
 * one request per conversation is ever in flight.
 */
export const useConversationPublishHistory =
  (): UseConversationPublishHistoryResult => {
    const [entries, setEntries] = useState<
      Record<string, PublishHistoryEntryState | undefined>
    >({});
    /* When each path's in-flight-or-resolved lookup started, so reopening the
     * same menu does not re-issue the request until the result goes stale. */
    const requestedAtRef = useRef(new Map<string, number>());
    /* Paths with a lookup in flight. The timestamp alone stops a repeat inside
     * the TTL but not one just outside it, and a request that outlives the
     * window would otherwise be joined by a second — which is both a wasted
     * scan and a chance for the slower response to land last and overwrite the
     * newer folders. One request per path at a time removes both. */
    const inFlightRef = useRef(new Set<string>());

    const requestPublishHistory = useCallback((path: string) => {
      if (inFlightRef.current.has(path)) {
        return;
      }
      const requestedAt = requestedAtRef.current.get(path);
      if (
        requestedAt != null &&
        Date.now() - requestedAt < PUBLISH_HISTORY_TTL_MS
      ) {
        return;
      }
      requestedAtRef.current.set(path, Date.now());
      inFlightRef.current.add(path);
      /* A revalidation keeps the folders already on screen: replacing them with
       * `Loading` would blink the open menu's Unpublish entry out and back. */
      setEntries((prev) => ({
        ...prev,
        [path]: prev[path]?.entries
          ? prev[path]
          : { status: PublishHistoryStatus.Loading },
      }));

      const resolve = async () => {
        try {
          const history = await getConversationPublishHistory(path);
          setEntries((prev) => ({
            ...prev,
            [path]: {
              status: PublishHistoryStatus.Resolved,
              entries: history.map(mapPublishConversationResultDto),
            },
          }));
        } catch {
          /*
           * A failed lookup hides the Unpublish entry rather than showing one
           * that cannot do anything, and raises no notification — the user
           * opened a menu, they did not ask for history. The timestamp is
           * dropped so the next menu open retries immediately instead of
           * waiting out the TTL: a failure is forgotten, while a request still
           * in flight is remembered until it settles.
           */
          requestedAtRef.current.delete(path);
          setEntries((prev) => ({
            ...prev,
            [path]: { status: PublishHistoryStatus.Failed },
          }));
        } finally {
          inFlightRef.current.delete(path);
        }
      };
      void resolve();
    }, []);

    const getPublishHistory = useCallback(
      (path: string) => entries[path] ?? IDLE_ENTRY,
      [entries],
    );

    return { requestPublishHistory, getPublishHistory };
  };
