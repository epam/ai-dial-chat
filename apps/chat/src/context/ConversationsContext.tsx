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
  listConversations,
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

  const value = useMemo(
    () => ({
      conversations,
      isLoading,
      error,
      pinConversation,
      deleteConversation,
      refreshConversations,
    }),
    [
      conversations,
      isLoading,
      error,
      pinConversation,
      deleteConversation,
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
