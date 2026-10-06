import type {
  ConversationDeletionResultDto,
  ConversationListItemDto,
  ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getConversationPath,
  isConversationNotFoundError,
  safeDecodeURIComponent,
} from '@epam/ai-dial-chat-hooks';
import { generateUUID } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { normalizeConversationId } from '../constants/routes';
import { useConversationDiscovery } from '../hooks/conversation/useConversationDiscovery';
import {
  deleteAllConversations as apiDeleteAllConversations,
  deleteConversation as apiDeleteConversation,
  duplicateConversation as apiDuplicateConversation,
  generateConversationTitle as apiGenerateConversationTitle,
  getConversation,
  listConversations,
  markConversationViewed as apiMarkConversationViewed,
  renameConversation as apiRenameConversation,
  watchConversation,
} from '../server-api/conversations.api';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../utils/conversation-id-match';
import { useUser } from './auth/UserContext';
import { useOptionalOverlay } from './overlay/OverlayContext';
import { useUserConfig } from './UserConfigContext';

const DISPLAY_NAME_WATCH_TIMEOUT_MS = 120_000;

/* Viewed state is monotonic: an older list response cannot undo a local view. */
const applyViewedState = (
  items: ConversationListItemDto[],
  viewedIds: ReadonlySet<string>,
): ConversationListItemDto[] =>
  items.map((item) =>
    item.isUnread && viewedIds.has(toPanelConversationId(item.id))
      ? { ...item, isUnread: false }
      : item,
  );

/* Returns `prev` untouched when nothing changes, so React skips the update. */
const setPinnedState = (
  prev: ConversationListItemDto[],
  id: string,
  isPinned: boolean,
): ConversationListItemDto[] => {
  const index = prev.findIndex((c) => c.id === id);
  if (index === -1 || prev[index].isPinned === isPinned) return prev;
  const next = prev.slice();
  next[index] = { ...prev[index], isPinned };
  return next;
};

interface ConversationsContextType {
  /** Flat list of all loaded conversations. */
  conversations: ConversationListItemDto[];
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null if the fetch failed. */
  error: Error | null;
  /** Toggle the pinned state of a conversation and persist it to the backend. Reverts on failure. */
  pinConversation: (id: string, isPinned: boolean) => Promise<void>;
  /**
   * Marks a scheduler-created conversation as viewed, clearing its unread
   * indicator optimistically and persisting to the backend. Reverts on
   * failure. No-op for conversations that are not scheduler-created or
   * already read.
   */
  markConversationViewed: (id: string) => Promise<void>;
  /** Delete a conversation by id, removing it from the local list on success. */
  deleteConversation: (id: string) => Promise<void>;
  /**
   * Removes a conversation from the local list without calling the delete
   * API. Use when the conversation was already deleted server-side by
   * another flow (e.g. deleting its last message empties it out).
   */
  removeConversationFromList: (id: string) => void;
  /** Rename a conversation; optimistically updates title, reverts on failure. The conversation id never changes. */
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  /**
   * Requests an LLM-generated title suggestion for a conversation. Returns the
   * suggested name without persisting it — the caller confirms via renameConversation.
   */
  generateConversationTitle: (id: string) => Promise<string>;
  /** Duplicate a conversation into the user's own bucket; returns the new conversation id. */
  duplicateConversation: (id: string) => Promise<string>;
  /**
   * Re-fetch the full conversation list in the background without hiding
   * loaded items. When expected ids are supplied, retry missing conversations
   * up to five times, two seconds apart, even after leaving the calling page.
   */
  refreshConversations: (expectedIds?: readonly string[]) => Promise<void>;
  /** Updates the sidebar title for a conversation without changing its id. */
  updateConversationTitle: (id: string, title: string) => void;
  /**
   * Stamps a conversation as just-updated and lifts it to the top of the
   * list, matching the listing endpoint's `updatedAt`-descending order.
   * Call it when a generation starts so the chat reorders immediately
   * instead of only after the next full re-fetch. No-op for unknown ids.
   */
  bumpConversationActivity: (id: string) => void;
  /**
   * Polls GET conversation until the display name changes or LLM naming completes.
   * Returns a cleanup function that cancels polling.
   */
  watchForDisplayNameUpdate: (
    conversationId: string,
    previousName: string,
    onUpdated: (title: string) => void,
  ) => () => void;
  /**
   * Delete every conversation in the authenticated user's bucket.
   * Returns the structured result. The list is re-fetched whenever at least one
   * item was deleted or absent (preserving shared/public conversations).
   * On total failure local state is unchanged.
   * Throws if the API call itself fails before returning per-item results.
   */
  deleteAllConversations: () => Promise<ConversationDeletionResultDto>;
}

const ConversationsContext = createContext<
  ConversationsContextType | undefined
>(undefined);

export const ConversationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { setPinnedConversation } = useUserConfig();
  const { user } = useUser();
  const userSub = user?.sub;
  const [conversations, setConversations] = useState<ConversationListItemDto[]>(
    [],
  );
  const conversationsRef = useRef<ConversationListItemDto[]>([]);
  const viewedIdsRef = useRef<Set<string> | null>(null);
  const viewedWriteQueueRef = useRef<Promise<void> | null>(null);
  const listRequestIdRef = useRef(0);
  const appliedListRequestIdRef = useRef(0);
  useLayoutEffect(() => {
    viewedIdsRef.current = new Set<string>();
    viewedWriteQueueRef.current = null;
    conversationsRef.current = [];
    return () => {
      viewedIdsRef.current = null;
    };
  }, [userSub]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const overlay = useOptionalOverlay();

  useEffect(() => {
    overlay?.notifyConversationsUpdated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useLayoutEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const refreshConversationList = useCallback(async () => {
    const currentViewedIds = viewedIdsRef.current;
    if (!currentViewedIds) return;
    const requestId = ++listRequestIdRef.current;
    setError(null);
    try {
      const response = await listConversations();
      if (
        viewedIdsRef.current !== currentViewedIds ||
        requestId < appliedListRequestIdRef.current
      )
        return;
      appliedListRequestIdRef.current = requestId;
      setError(null);
      setConversations(applyViewedState(response.items, currentViewedIds));
    } catch (err) {
      if (
        viewedIdsRef.current !== currentViewedIds ||
        requestId !== listRequestIdRef.current
      )
        return;
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const refreshConversations = useConversationDiscovery(
    conversations,
    refreshConversationList,
    userSub,
  );

  const silentRefreshConversations = useCallback(async () => {
    const currentViewedIds = viewedIdsRef.current;
    if (!currentViewedIds) return;
    const requestId = ++listRequestIdRef.current;
    try {
      const response = await listConversations();
      if (
        viewedIdsRef.current !== currentViewedIds ||
        requestId < appliedListRequestIdRef.current
      )
        return;
      appliedListRequestIdRef.current = requestId;
      setError(null);
      setConversations(applyViewedState(response.items, currentViewedIds));
    } catch {
      // Background refresh must not disturb the panel loading state.
    }
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    /* Returning `prev` on a no-op lets React bail out — every conversation
       load calls this, usually with the title the list already has. */
    setConversations((prev) => {
      const index = prev.findIndex((item) => conversationIdsMatch(item.id, id));
      if (index === -1 || prev[index].title === title) return prev;
      const next = prev.slice();
      next[index] = { ...prev[index], title };
      return next;
    });
  }, []);

  const bumpConversationActivity = useCallback((id: string) => {
    /* Read the clock outside the updater so it stays a pure reducer — React
       may invoke it more than once for a single call. */
    const bumpedAt = Date.now();

    setConversations((prev) => {
      const index = prev.findIndex((c) => conversationIdsMatch(c.id, id));
      if (index === -1) return prev;

      const bumped = { ...prev[index], updatedAt: bumpedAt };
      const rest = prev.filter((_, i) => i !== index);
      /*
       * The listing endpoint already returns items sorted by `updatedAt`
       * descending, so re-sorting locally leaves the rest of the list
       * untouched (Array#sort is stable) and only lifts the bumped item.
       * Prepending first keeps it ahead of any entry carrying the very same
       * timestamp.
       */
      return [bumped, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const watchForDisplayNameUpdate = useCallback(
    (
      conversationId: string,
      previousName: string,
      onUpdated: (title: string) => void,
    ) => {
      const normalizedConversationId = normalizeConversationId(conversationId);
      const conversationPath = getConversationPath(normalizedConversationId);
      const fullConversationId = safeDecodeURIComponent(
        normalizedConversationId,
      );

      const controller = new AbortController();

      const run = async () => {
        let stream: ReadableStream<Uint8Array>;
        try {
          stream = await watchConversation(conversationPath, controller.signal);
        } catch {
          return;
        }

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, DISPLAY_NAME_WATCH_TIMEOUT_MS);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;

              const data = trimmed.slice(5).trim();
              let event: { url?: string; action?: string } | null = null;
              try {
                event = JSON.parse(data) as { url?: string; action?: string };
              } catch {
                continue;
              }

              if (event?.action !== 'UPDATE') continue;

              /* Only events for the watched resource qualify. The bucket is not
               * compared: a shared conversation resolves to its owner's bucket
               * server-side, so the path after the bucket is what identifies it. */
              const eventPath = event.url
                ? safeDecodeURIComponent(event.url)
                : undefined;
              if (eventPath && !eventPath.endsWith(`/${conversationPath}`)) {
                continue;
              }

              try {
                /* `getConversation` needs the full bucket-qualified path;
                 * `conversationPath` (stripped for `watchConversation`,
                 * which re-qualifies server-side) would break any deployment
                 * id containing a slash, e.g. `applications/{bucket}/{app}`. */
                const conversation = (await getConversation(
                  fullConversationId,
                )) as ConversationResponseDto;
                const nextName = conversation.name?.trim();
                if (
                  conversation.llmNamingDone === true ||
                  (nextName && nextName !== previousName.trim())
                ) {
                  if (nextName) {
                    updateConversationTitle(conversationId, nextName);
                    onUpdated(nextName);
                    void silentRefreshConversations();
                  }
                  /* Closes the SSE connection; releasing the reader alone
                   * would leave the request open until the timeout. */
                  controller.abort();
                  return;
                }
              } catch {
                // Keep watching until stream ends or timeout.
              }
            }
          }
        } catch {
          // AbortError on timeout/unmount or unexpected stream error — exit silently.
        } finally {
          clearTimeout(timeoutId);
          reader.releaseLock();
        }
      };

      void run();

      return () => {
        controller.abort();
      };
    },
    [silentRefreshConversations, updateConversationTitle],
  );

  /*
   * userSub is included so that if the authenticated identity changes while
   * this provider stays mounted (an in-place identity adoption — see
   * spa-auth-session's identity revalidation requirement), the conversation
   * list is refetched instead of continuing to serve the previous identity's
   * snapshot.
   */
  useEffect(() => {
    let cancelled = false;
    const viewedIds = viewedIdsRef.current;
    if (!viewedIds) return;

    const load = async () => {
      const requestId = ++listRequestIdRef.current;
      setIsLoading(true);
      setError(null);
      setConversations([]);
      try {
        const response = await listConversations();
        if (!cancelled && requestId >= appliedListRequestIdRef.current) {
          appliedListRequestIdRef.current = requestId;
          setError(null);
          setConversations(applyViewedState(response.items, viewedIds));
        }
      } catch (err) {
        if (!cancelled && requestId === listRequestIdRef.current)
          setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [userSub]);

  const pinConversation = useCallback(
    async (id: string, isPinned: boolean) => {
      setConversations((prev) => setPinnedState(prev, id, isPinned));
      try {
        await setPinnedConversation(id, isPinned);
      } catch (err) {
        setConversations((prev) => setPinnedState(prev, id, !isPinned));
        console.error('Failed to persist pin state', err);
      }
    },
    [setPinnedConversation],
  );

  const markConversationViewed = useCallback(async (id: string) => {
    const target = conversationsRef.current.find((c) =>
      conversationIdsMatch(c.id, id),
    );
    if (!target?.isScheduledTask || !target.isUnread) return;
    const currentViewedIds = viewedIdsRef.current;
    const key = toPanelConversationId(target.id);
    if (!currentViewedIds || currentViewedIds.has(key)) return;
    currentViewedIds.add(key);

    setConversations((prev) => applyViewedState(prev, currentViewedIds));
    const previousWrite = viewedWriteQueueRef.current;
    /* The backend updates one viewed-ids file. Serialize rapid navigation
       within this provider so two read/modify/write requests cannot lose ids. */
    const persist = async () => {
      if (previousWrite) await previousWrite;
      if (viewedIdsRef.current !== currentViewedIds) return;
      try {
        const conversationPath = getConversationPath(
          normalizeConversationId(target.id),
        );
        await apiMarkConversationViewed(conversationPath);
      } catch {
        if (viewedIdsRef.current !== currentViewedIds) return;
        currentViewedIds.delete(key);
        setConversations((prev) =>
          prev.map((c) =>
            conversationIdsMatch(c.id, target.id)
              ? { ...c, isUnread: true }
              : c,
          ),
        );
      }
    };
    const write = persist();
    viewedWriteQueueRef.current = write;
    await write;
    if (viewedWriteQueueRef.current === write)
      viewedWriteQueueRef.current = null;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    let snapshot: ConversationListItemDto[] | undefined;
    setConversations((prev) => {
      snapshot = prev;
      /*
       * Matched the same way as removeConversationFromList: a caller passing a
       * differently-encoded id would otherwise keep its stale row on a 404 —
       * the exact staleness this path exists to clear.
       */
      return prev.filter((c) => !conversationIdsMatch(c.id, id));
    });
    const conversationPath = getConversationPath(normalizeConversationId(id));
    try {
      await apiDeleteConversation(conversationPath);
    } catch (err) {
      /*
       * Already gone upstream: the row was stale, so removing it is the
       * intended outcome. Restoring it would leave the user with an entry
       * that neither opens nor deletes.
       */
      if (isConversationNotFoundError(err)) return;
      if (snapshot) setConversations(snapshot);
      throw err;
    }
  }, []);

  /**
   * Removes a conversation from the local list without calling the delete
   * API. Use when the conversation was already deleted server-side by
   * another flow (e.g. deleting its last message empties it out).
   */
  const removeConversationFromList = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => !conversationIdsMatch(c.id, id));
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      let originalTitle: string | undefined;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          originalTitle = c.title;
          return { ...c, title: newTitle };
        }),
      );

      const conversationPath = getConversationPath(normalizeConversationId(id));
      try {
        const { name } = await apiRenameConversation(
          conversationPath,
          newTitle,
        );
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: name } : c)),
        );
      } catch (err) {
        if (originalTitle != null) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, title: originalTitle as string } : c,
            ),
          );
        }
        throw err;
      }
    },
    [],
  );

  const generateConversationTitle = useCallback(async (id: string) => {
    const conversationPath = getConversationPath(normalizeConversationId(id));
    const { name } = await apiGenerateConversationTitle(conversationPath);
    return name;
  }, []);

  const duplicateConversation = useCallback(
    async (id: string) => {
      const source = conversationsRef.current.find((c) => c.id === id);
      const tempId = generateUUID();
      setConversations((prev) => [
        {
          id: tempId,
          title: source?.title ?? '',
          updatedAt: Date.now(),
          sharedWithMe: false,
          publishedWithMe: false,
          isPinned: false,
          isReadonly: false,
          isScheduledTask: false,
        },
        ...prev,
      ]);
      try {
        const conversationPath = normalizeConversationId(id);
        const { newPath } = await apiDuplicateConversation(conversationPath);
        setConversations((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: newPath } : c)),
        );
        void silentRefreshConversations();
        return newPath;
      } catch (err) {
        setConversations((prev) => prev.filter((c) => c.id !== tempId));
        throw err;
      }
    },
    [silentRefreshConversations],
  );

  const deleteAllConversations =
    useCallback(async (): Promise<ConversationDeletionResultDto> => {
      const result = await apiDeleteAllConversations();

      if (
        result.deleted > 0 ||
        result.alreadyAbsent > 0 ||
        result.failed.length === 0
      ) {
        await refreshConversations();
      }

      return result;
    }, [refreshConversations]);

  const value = useMemo(
    () => ({
      conversations,
      isLoading,
      error,
      pinConversation,
      markConversationViewed,
      deleteConversation,
      removeConversationFromList,
      renameConversation,
      generateConversationTitle,
      duplicateConversation,
      refreshConversations,
      updateConversationTitle,
      bumpConversationActivity,
      watchForDisplayNameUpdate,
      deleteAllConversations,
    }),
    [
      conversations,
      isLoading,
      error,
      pinConversation,
      markConversationViewed,
      deleteConversation,
      removeConversationFromList,
      renameConversation,
      generateConversationTitle,
      duplicateConversation,
      refreshConversations,
      updateConversationTitle,
      bumpConversationActivity,
      watchForDisplayNameUpdate,
      deleteAllConversations,
    ],
  );

  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
};

export const useConversations = (): ConversationsContextType => {
  const ctx = useContext(ConversationsContext);
  if (!ctx)
    throw new Error(
      'useConversations must be used inside ConversationsProvider',
    );
  return ctx;
};
