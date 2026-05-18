import { Conversation, Message, MessageRole } from '@epam/chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { createConversation as apiCreateConversation } from '../server-api/conversations.api';

// TODO: review context and investigate - we can use some store like Zustand or Jotai instead of context for better performance and simpler code
interface ConversationContextValue {
  conversations: Map<string, Conversation>;
  createConversation: (firstMessage: string) => Promise<string>;
  sendMessage: (conversationId: string, message: string) => void;
}

const ConversationContext = createContext<ConversationContextValue | undefined>(
  undefined,
);

export const ConversationProvider = ({ children }: { children: ReactNode }) => {
  const [conversations, setConversations] = useState<Map<string, Conversation>>(
    () => new Map(),
  );

  const createConversation = useCallback(
    async (firstMessage: string): Promise<string> => {
      const conversation = await apiCreateConversation(firstMessage);

      setConversations((prev) =>
        new Map(prev).set(conversation.id, conversation),
      );
      return conversation.id;
    },
    [],
  );

  const sendMessage = useCallback((conversationId: string, message: string) => {
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: MessageRole.User,
      content: message,
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) => {
      const map = new Map(prev);
      const conv = map.get(conversationId);
      if (!conv) return map;
      return map.set(conversationId, {
        ...conv,
        messages: [...conv.messages, userMessage],
      });
    });
  }, []);

  const value = useMemo(
    () => ({ conversations, createConversation, sendMessage }),
    [conversations, createConversation, sendMessage],
  );

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = (): ConversationContextValue => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error(
      'useConversation must be used within a ConversationProvider',
    );
  }
  return context;
};
