import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import { useCallback, useRef, useState } from 'react';
import { getConversationPublishHistory } from '../../server-api/conversation-publish.api';
import { PublishHistoryStatus } from '../../types/publish-history';
import { mapPublishConversationResultDto } from '../../utils/publish';

/** State of one conversation's publish-history lookup. */
export interface PublishHistoryEntryState {
  /** Where the lookup for this conversation currently stands. */
  status: PublishHistoryStatus;
  /** Folders the conversation is published to; present only once the status is `Resolved`. */
  entries?: PublishHistoryEntry[];
}

/** Per-conversation publish-history lookups resolved on demand. */
export interface UseConversationPublishHistoryResult {
  /** Starts a lookup for the conversation unless one already ran for it. */
  requestPublishHistory: (path: string) => void;
  /** Current lookup state for the conversation. */
  getPublishHistory: (path: string) => PublishHistoryEntryState;
}

const IDLE_ENTRY: PublishHistoryEntryState = {
  status: PublishHistoryStatus.Idle,
};

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
 */
export const useConversationPublishHistory =
  (): UseConversationPublishHistoryResult => {
    const [entries, setEntries] = useState<
      Record<string, PublishHistoryEntryState | undefined>
    >({});
    /* Paths whose lookup has already started, so reopening the same menu does
     * not re-issue the request. */
    const requestedPathsRef = useRef(new Set<string>());

    const requestPublishHistory = useCallback((path: string) => {
      if (requestedPathsRef.current.has(path)) return;
      requestedPathsRef.current.add(path);
      setEntries((prev) => ({
        ...prev,
        [path]: { status: PublishHistoryStatus.Loading },
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
           * opened a menu, they did not ask for history. Cleared from the
           * started set so the next menu open retries.
           */
          requestedPathsRef.current.delete(path);
          setEntries((prev) => ({
            ...prev,
            [path]: { status: PublishHistoryStatus.Failed },
          }));
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
