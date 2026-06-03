import type { ConversationListItemDto } from '@epam/chat-api-client';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { listConversations } from '../server-api/conversations.api';

interface ConversationsContextType {
  /** Flat list of all loaded conversations. */
  conversations: ConversationListItemDto[];
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null if the fetch failed. */
  error: Error | null;
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

  const value = useMemo(
    () => ({ conversations, isLoading, error }),
    [conversations, isLoading, error],
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
