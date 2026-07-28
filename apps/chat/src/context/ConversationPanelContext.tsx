import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface ConversationPanelContextValue {
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const ConversationPanelContext = createContext<
  ConversationPanelContextValue | undefined
>(undefined);
ConversationPanelContext.displayName = 'ConversationPanelContext';

export const ConversationPanelProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  return (
    <ConversationPanelContext.Provider
      value={useMemo(
        () => ({ isPanelOpen, openPanel, closePanel }),
        [isPanelOpen, openPanel, closePanel],
      )}
    >
      {children}
    </ConversationPanelContext.Provider>
  );
};

export const useConversationPanel = (): ConversationPanelContextValue => {
  const value = useContext(ConversationPanelContext);
  if (!value) {
    throw new Error(
      'useConversationPanel must be used within a ConversationPanelProvider',
    );
  }
  return value;
};
