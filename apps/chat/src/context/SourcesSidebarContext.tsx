import type { Message } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/** Value exposed by the sources sidebar context. */
export interface SourcesSidebarContextValue {
  /** Whether the sidebar is currently open. */
  isOpen: boolean;
  /** Open the sidebar. */
  handleOpen: () => void;
  /** Close the sidebar. */
  handleClose: () => void;
  /** Messages of the active conversation; used to derive uploaded and generated files. */
  messages: Message[];
  /** Set conversation messages for the files sections. Pass `[]` on page unmount to clear stale data. */
  setMessages: (messages: Message[]) => void;
  /** Model id of the active conversation — the deployment that produced its messages. `undefined` while no conversation is active. */
  conversationModelId: string | undefined;
  /** Set the active conversation's model id. Pass `undefined` on page unmount to clear stale data. */
  setConversationModelId: (id: string | undefined) => void;
}

const SourcesSidebarContext = createContext<
  SourcesSidebarContextValue | undefined
>(undefined);
SourcesSidebarContext.displayName = 'SourcesSidebarContext';

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

  return (
    <SourcesSidebarContext.Provider
      value={useMemo(
        () => ({
          isOpen,
          handleClose,
          handleOpen,
          messages,
          setMessages,
          conversationModelId,
          setConversationModelId,
        }),
        [
          isOpen,
          handleClose,
          handleOpen,
          messages,
          setMessages,
          conversationModelId,
          setConversationModelId,
        ],
      )}
    >
      {children}
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
