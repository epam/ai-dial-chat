import type { Message } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/** Controls of the sources sidebar; every member except `isOpen` is stable. */
export interface SourcesSidebarContextValue {
  /** Whether the sidebar is currently open. */
  isOpen: boolean;
  /** Open the sidebar. */
  handleOpen: () => void;
  /** Close the sidebar. */
  handleClose: () => void;
  /** Set conversation messages for the files sections. Pass `[]` on page unmount to clear stale data. */
  setMessages: (messages: Message[]) => void;
  /** Set the active conversation's model id. Pass `undefined` on page unmount to clear stale data. */
  setConversationModelId: (id: string | undefined) => void;
}

/** Data published to the sources sidebar by the active conversation page. */
export interface SourcesSidebarDataContextValue {
  /** Messages of the active conversation; used to derive uploaded and generated files. */
  messages: Message[];
  /** Model id of the active conversation — the deployment that produced its messages. `undefined` while no conversation is active. */
  conversationModelId: string | undefined;
}

const SourcesSidebarContext = createContext<
  SourcesSidebarContextValue | undefined
>(undefined);
SourcesSidebarContext.displayName = 'SourcesSidebarContext';

/*
 * Kept apart from the controls: the page publishes messages on every stream
 * chunk, and only the sources panel reads them. With one context every
 * `useSourcesSidebar()` consumer — the whole App shell included — re-rendered
 * per chunk just to read stable callbacks.
 */
const SourcesSidebarDataContext = createContext<
  SourcesSidebarDataContextValue | undefined
>(undefined);
SourcesSidebarDataContext.displayName = 'SourcesSidebarDataContext';

export const SourcesSidebarProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationModelId, setConversationModelId] = useState<
    string | undefined
  >(undefined);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const controls = useMemo(
    () => ({
      isOpen,
      handleClose,
      handleOpen,
      setMessages,
      setConversationModelId,
    }),
    [isOpen, handleClose, handleOpen],
  );
  const data = useMemo(
    () => ({ messages, conversationModelId }),
    [messages, conversationModelId],
  );

  return (
    <SourcesSidebarContext.Provider value={controls}>
      <SourcesSidebarDataContext.Provider value={data}>
        {children}
      </SourcesSidebarDataContext.Provider>
    </SourcesSidebarContext.Provider>
  );
};

export const useSourcesSidebar = (): SourcesSidebarContextValue => {
  const value = useContext(SourcesSidebarContext);
  if (!value) {
    throw new Error(
      'useSourcesSidebar must be used within a SourcesSidebarProvider',
    );
  }
  return value;
};

export const useSourcesSidebarData = (): SourcesSidebarDataContextValue => {
  const value = useContext(SourcesSidebarDataContext);
  if (!value) {
    throw new Error(
      'useSourcesSidebarData must be used within a SourcesSidebarProvider',
    );
  }
  return value;
};
