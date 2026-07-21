import type {
  ConversationDeletionResultDto,
  ConversationListItemDto,
  ConversationResponseDto,
} from '@epam/chat-api-client';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { normalizeConversationId } from '../constants/routes';
import {
  deleteAllConversations as apiDeleteAllConversations,
  deleteConversation as apiDeleteConversation,
  duplicateConversation as apiDuplicateConversation,
  generateConversationTitle as apiGenerateConversationTitle,
  getConversation,
  listConversations,
  renameConversation as apiRenameConversation,
  watchConversation,
} from '../server-api/conversations.api';
import { conversationIdsMatch } from '../utils/conversation-id-match';
import { getConversationPath } from '../utils/conversation-path';
import { useOptionalOverlay } from './overlay/OverlayContext';
import { useUserConfig } from './UserConfigContext';

const DISPLAY_NAME_WATCH_TIMEOUT_MS = 120_000;

interface ConversationsContextType {
  /** Flat list of all loaded conversations. */
  conversations: ConversationListItemDto[];
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null if the fetch failed. */
  error: Error | null;
  /** Toggle the pinned state of a conversation and persist it to the backend. Reverts on failure. */
  pinConversation: (id: string, isPinned: boolean) => Promise<void>;
  /** Delete a conversation by id, removing it from the local list on success. */
  deleteConversation: (id: string) => Promise<void>;
  /** Rename a conversation; optimistically updates title, reverts on failure. The conversation id never changes. */
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  /**
   * Requests an LLM-generated title suggestion for a conversation. Returns the
   * suggested name without persisting it — the caller confirms via renameConversation.
   */
  generateConversationTitle: (id: string) => Promise<string>;
  /** Duplicate a conversation into the user's own bucket; returns the new conversation id. */
  duplicateConversation: (id: string) => Promise<string>;
  /** Re-fetch the full conversation list from the server. */
  refreshConversations: () => Promise<void>;
  /** Updates the sidebar title for a conversation without changing its id. */
  updateConversationTitle: (id: string, title: string) => void;
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
  const [conversations, setConversations] = useState<ConversationListItemDto[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const overlay = useOptionalOverlay();

  useEffect(() => {
    overlay?.notifyConversationsUpdated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const refreshConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listConversations();
      setConversations(response.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const silentRefreshConversations = useCallback(async () => {
    try {
      const response = await listConversations();
      setConversations(response.items);
    } catch {
      // Background refresh must not disturb the panel loading state.
    }
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((item) =>
        conversationIdsMatch(item.id, id) ? { ...item, title } : item,
      ),
    );
  }, []);

  const watchForDisplayNameUpdate = useCallback(
    (
      conversationId: string,
      previousName: string,
      onUpdated: (title: string) => void,
    ) => {
      const conversationPath = getConversationPath(
        normalizeConversationId(conversationId),
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

              try {
                const conversation = (await getConversation(
                  conversationPath,
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listConversations();
        if (!cancelled) setConversations(response.items);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const pinConversation = useCallback(
    async (id: string, isPinned: boolean) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isPinned } : c)),
      );
      try {
        await setPinnedConversation(id, isPinned);
      } catch (err) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isPinned: !isPinned } : c)),
        );
        console.error('Failed to persist pin state', err);
      }
    },
    [setPinnedConversation],
  );

  const deleteConversation = useCallback(async (id: string) => {
    let snapshot: ConversationListItemDto[] | undefined;
    setConversations((prev) => {
      snapshot = prev;
      return prev.filter((c) => c.id !== id);
    });
    const conversationPath = getConversationPath(normalizeConversationId(id));
    try {
      await apiDeleteConversation(conversationPath);
    } catch (err) {
      if (snapshot) setConversations(snapshot);
      throw err;
    }
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
      const conversationPath = normalizeConversationId(id);
      const { newPath } = await apiDuplicateConversation(conversationPath);
      await refreshConversations();
      return newPath;
    },
    [refreshConversations],
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
      deleteConversation,
      renameConversation,
      generateConversationTitle,
      duplicateConversation,
      refreshConversations,
      updateConversationTitle,
      watchForDisplayNameUpdate,
      deleteAllConversations,
    }),
    [
      conversations,
      isLoading,
      error,
      pinConversation,
      deleteConversation,
      renameConversation,
      generateConversationTitle,
      duplicateConversation,
      refreshConversations,
      updateConversationTitle,
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
