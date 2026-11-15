import type {
  CreateConversationResponse,
  DeleteConversationResponse,
  GetMessagesResponse,
  OverlayConversation,
  RenameConversationResponse,
  SelectConversationResponse,
  SendMessageResponse,
  SetSystemPromptResponse,
  SetTemperatureResponse,
} from '@epam/ai-dial-chat-overlay';

/**
 * Read/write surface backed by whichever conversation `ConversationPage`
 * currently has mounted. Registered/unregistered by `ConversationPage` via
 * `registerActiveConversationBridge`.
 */
export interface ActiveConversationBridge {
  /** Returns the active conversation's messages. */
  getMessages: () => GetMessagesResponse;
  /** Sends a new message in the active conversation. */
  sendMessage: (content: string) => Promise<SendMessageResponse>;
  /** Sets the message input's current text content. */
  setInputContent: (content: string) => void;
  /** Persists a new system prompt on the active conversation. */
  setSystemPrompt: (systemPrompt: string) => Promise<SetSystemPromptResponse>;
  /** Persists a new temperature on the active conversation. */
  setTemperature: (temperature: number) => Promise<SetTemperatureResponse>;
}

/**
 * Read/write surface over the current user's conversation list, backed by
 * `ConversationsContext`/`DeploymentsContext`/navigation. Registered/
 * unregistered by the conversation-list bridge hook via
 * `registerConversationListBridge`.
 */
export interface ConversationListBridge {
  /** Returns the current user's conversation list. */
  getConversations: () => OverlayConversation[];
  /** Creates a new conversation, persisting immediately if `firstMessage` is given. */
  createConversation: (options: {
    deploymentId?: string;
    firstMessage?: string;
  }) => Promise<CreateConversationResponse>;
  /** Deletes the conversation matching `id`. */
  deleteConversation: (id: string) => Promise<DeleteConversationResponse>;
  /** Renames the conversation matching `id` to `newName`. */
  renameConversation: (
    id: string,
    newName: string,
  ) => Promise<RenameConversationResponse>;
  /** Navigates to the conversation matching `id`. */
  selectConversation: (id: string) => Promise<SelectConversationResponse>;
}
