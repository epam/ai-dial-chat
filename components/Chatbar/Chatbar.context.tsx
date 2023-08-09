import { ActionType } from '@/hooks/useCreateReducer';
import { Conversation } from '@/types/chat';
import { SupportedExportFormats } from '@/types/export';
import { createContext, Dispatch } from 'react';

import { ChatbarInitialState } from './Chatbar.state';

export type ImportConversationsHandler = (data: SupportedExportFormats) => void;
export interface ChatbarContextProps {
  state: ChatbarInitialState;
  dispatch: Dispatch<ActionType<ChatbarInitialState>>;
  handleDeleteConversation: (conversation: Conversation) => void;
  handleClearConversations: () => void;
  handleExportConversations: () => void;
  handleExportConversation: (conversationId: string) => void;
  handleImportConversations: ImportConversationsHandler;
}

const ChatbarContext = createContext<ChatbarContextProps>(undefined!);

export default ChatbarContext;
