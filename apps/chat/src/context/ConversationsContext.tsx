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
  getConversation,
  listConversations,
  renameConversation as apiRenameConversation,
} from '../server-api/conversations.api';
import { conversationIdsMatch } from '../utils/conversation-id-match';
import { getConversationPath } from '../utils/conversation-path';
import { useUserConfig } from './UserConfigContext';

const DISPLAY_NAME_POLL_INTERVAL_MS = 2000;
const DISPLAY_NAME_POLL_MAX_ATTEMPTS = 25;

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
  /** Rename a conversation; optimistically updates title, reverts on failure. Returns the new conversation id. */
  renameConversation: (id: string, newTitle: string) => Promise<string>;
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
      let cancelled = false;
      let attempts = 0;
      const conversationPath = getConversationPath(
        normalizeConversationId(conversationId),
      );

      const poll = async () => {
        if (cancelled) return;
        attempts += 1;

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
          // Keep polling until attempts are exhausted.
        }

        if (!cancelled && attempts < DISPLAY_NAME_POLL_MAX_ATTEMPTS) {
          window.setTimeout(() => {
            void poll();
          }, DISPLAY_NAME_POLL_INTERVAL_MS);
        }
      };

      void poll();

      return () => {
        cancelled = true;
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
        const { newPath } = await apiRenameConversation(
          conversationPath,
          newTitle,
        );
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, id: newPath } : c)),
        );
        return newPath;
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
