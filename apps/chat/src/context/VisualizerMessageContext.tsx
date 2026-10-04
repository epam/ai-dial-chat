import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

/** Send handler the active conversation page publishes for visualizer `SEND_MESSAGE`. */
export interface VisualizerMessageSender {
  /** Id of the conversation the handler sends into. */
  conversationId: string;
  /** Sends `content` as a user message, or drops it when the conversation cannot take one. */
  send: (content: string) => void;
}

/** Stable controls of the visualizer message bridge. */
export interface VisualizerMessageContextValue {
  /** Publishes the active conversation's sender; pass `null` to clear it. */
  registerSender: (sender: VisualizerMessageSender | null) => void;
  /** Returns the id of the conversation whose sender is registered, or `undefined`. */
  getRegisteredConversationId: () => string | undefined;
  /**
   * Sends `content` through the registered sender. Dropped when none is
   * registered, or when `sourceConversationId` is given and differs from the
   * registered conversation.
   */
  sendMessage: (content: string, sourceConversationId?: string) => void;
}

const VisualizerMessageContext = createContext<
  VisualizerMessageContextValue | undefined
>(undefined);
VisualizerMessageContext.displayName = 'VisualizerMessageContext';

/*
 * The attachment canvas is mounted in the app shell, outside the conversation
 * page that owns `handleSend`. This bridge lets the page publish its sender so a
 * visualizer opened in the canvas can still send into that conversation. The
 * sender lives in a ref: it changes on every stream chunk and nothing renders
 * from it.
 */
export const VisualizerMessageProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const senderRef = useRef<VisualizerMessageSender | null>(null);

  const registerSender = useCallback(
    (sender: VisualizerMessageSender | null) => {
      senderRef.current = sender;
    },
    [],
  );

  const getRegisteredConversationId = useCallback(
    () => senderRef.current?.conversationId,
    [],
  );

  const sendMessage = useCallback(
    (content: string, sourceConversationId?: string) => {
      const sender = senderRef.current;
      if (sender == null) return;
      if (
        sourceConversationId != null &&
        sourceConversationId !== sender.conversationId
      ) {
        return;
      }
      sender.send(content);
    },
    [],
  );

  const value = useMemo(
    () => ({ registerSender, getRegisteredConversationId, sendMessage }),
    [registerSender, getRegisteredConversationId, sendMessage],
  );

  return (
    <VisualizerMessageContext.Provider value={value}>
      {children}
    </VisualizerMessageContext.Provider>
  );
};

export const useVisualizerMessage = (): VisualizerMessageContextValue => {
  const ctx = useContext(VisualizerMessageContext);
  if (ctx == null) {
    throw new Error(
      'useVisualizerMessage must be used within VisualizerMessageProvider',
    );
  }
  return ctx;
};
