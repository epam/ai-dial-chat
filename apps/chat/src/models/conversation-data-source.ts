import type {
  ConversationResponseDto,
  ConversationsApi,
} from '@epam/ai-dial-chat-api-client';
import type { ConversationStreamTransport } from '@epam/ai-dial-chat-hooks';
import type { ProjectsI18nKeys } from '../constants/translation-keys';

/** The sidebar list side effects of a conversation page; a project chat has none. */
export interface ConversationListSync {
  updateTitle: (id: string, title: string) => void;
  bumpActivity: (id: string) => void;
  /** Shows the unread indicator until the conversation is viewed. */
  markUnread: (id: string) => void;
  /** Records that the conversation was seen and clears its unread indicator. */
  markViewed: (id: string) => Promise<void>;
  remove: (id: string) => void;
  refresh: (expectedIds?: readonly string[]) => Promise<void>;
}

/**
 * Where `ConversationPage` reads and writes its conversation, and where it
 * navigates. The regular value wraps the `/api/v1/conversations` calls; a
 * project chat supplies one over the project conversation endpoints.
 */
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
  /** Sidebar list side effects; `NO_CONVERSATION_LIST_SYNC` when the conversation is not in the sidebar. */
  listSync: ConversationListSync;
  /** Whether a read-only conversation offers Duplicate. */
  canDuplicate: boolean;
  /** Translation key of the toast shown when the conversation cannot be loaded; the page's own when unset. */
  notFoundMessageKey?: ProjectsI18nKeys;
}
