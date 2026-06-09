import type { ConversationListItemDto } from '@epam/chat-api-client';
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
  deleteConversation as apiDeleteConversation,
  duplicateConversation as apiDuplicateConversation,
  listConversations,
  renameConversation as apiRenameConversation,
} from '../server-api/conversations.api';
import { pinConversation as apiPinConversation } from '../server-api/user-config.api';
import { getConversationPath } from '../utils/conversation-path';

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
  /** Rename a conversation; optimistically updates title, reverts on failure. */
  renameConversation: (id: string, newTitle: string) => Promise<void>;
  /** Duplicate a conversation into the user's own bucket; returns the new conversation id. */
  duplicateConversation: (id: string) => Promise<string>;
  /** Re-fetch the full conversation list from the server. */
  refreshConversations: () => Promise<void>;
}

const ConversationsContext = createContext<
  ConversationsContextType | undefined
>(undefined);

export const ConversationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
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

  const pinConversation = useCallback(async (id: string, isPinned: boolean) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned } : c)),
    );
    try {
      await apiPinConversation(id, isPinned);
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isPinned: !isPinned } : c)),
      );
      console.error('Failed to persist pin state', err);
    }
  }, []);

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
