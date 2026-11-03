import type {
  ConversationResponseDto,
  ConversationsApi,
} from '@epam/ai-dial-chat-api-client';
import type { ConversationStreamTransport } from './useConversationStream/useConversationStream';

/** The sidebar list side effects of a conversation page; a conversation outside the sidebar has none. */
export interface ConversationListSync {
  /** Shows a new title on the conversation's row. */
  updateTitle: (id: string, title: string) => void;
  /** Moves the conversation's row up after activity. */
  bumpActivity: (id: string) => void;
  /** Shows the unread indicator until the conversation is viewed. */
  markUnread: (id: string) => void;
  /** Records that the conversation was seen and clears its unread indicator. */
  markViewed: (id: string) => Promise<void>;
  /** Removes the conversation's row. */
  remove: (id: string) => void;
  /** Re-reads the list, optionally waiting until the given ids appear in it. */
  refresh: (expectedIds?: readonly string[]) => Promise<void>;
  /** The open chat is marked viewed without a sidebar row saying it is unread; a project chat has no row. */
  shouldMarkOpenChatViewed?: boolean;
}

/** Where a conversation page reads and writes its conversation, and where it navigates. */
export interface ConversationDataSource {
  /** Stream, stop, attach, get and save for `useConversationStream`. */
  transport: ConversationStreamTransport;
  /** Loads a conversation by its id (also the custom-viewer reload). */
  getConversation: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<ConversationResponseDto>;
  /** Saves a conversation by its stream path (model changes, status messages). */
  saveConversation: (
    path: string,
    conversation: ConversationResponseDto,
  ) => Promise<ConversationResponseDto>;
  /** Save and delete for `useConversationHandlers`. */
  handlersApi: Pick<
    ConversationsApi,
    'saveConversation' | 'deleteConversation'
  >;
  /** Watches for the title the first reply produces; returns a cleanup. */
  watchTitle: (
    id: string,
    previousName: string,
    onUpdated: (title: string) => void,
  ) => () => void;
  /** The route of a conversation (after duplicate or a custom-viewer create). */
  getConversationRoute: (id: string) => string;
  /** Where a deleted or missing conversation navigates. */
  getExitRoute: () => string;
  /** Whether the conversation opens read-only. */
  isReadOnly: (id: string) => boolean;
  /** Sidebar list side effects; {@link NO_CONVERSATION_LIST_SYNC} when the conversation is not in the sidebar. */
  listSync: ConversationListSync;
  /** Whether a read-only conversation offers Duplicate. */
  canDuplicate: boolean;
  /** Translation key of the toast shown when the conversation cannot be loaded; the page's own when unset. The host resolves it. */
  notFoundMessageKey?: string;
}

/** List side effects of a conversation that is not in the sidebar: each one does nothing. */
export const NO_CONVERSATION_LIST_SYNC: ConversationListSync = {
  updateTitle: () => undefined,
  bumpActivity: () => undefined,
  markUnread: () => undefined,
  markViewed: async () => undefined,
  remove: () => undefined,
  refresh: async () => undefined,
};
