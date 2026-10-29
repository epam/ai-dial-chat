import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { getConversationRoute } from '../constants/routes';
import type {
  ConversationDataSource,
  ConversationListSync,
} from '../models/conversation-data-source';
import { conversationsApi } from '../server-api/api-client';
import {
  getConversation,
  saveConversation,
} from '../server-api/conversations.api';
import { ROUTES } from '../types/routes';
import { conversationStreamTransport } from './conversation-stream-transport';

/** List side effects of a conversation that is not in the sidebar: each one does nothing. */
export const NO_CONVERSATION_LIST_SYNC: ConversationListSync = {
  updateTitle: () => undefined,
  bumpActivity: () => undefined,
  remove: () => undefined,
  refresh: async () => undefined,
};

/**
 * Whether a top-level conversation opens read-only: the list item's share
 * flags when it is loaded, otherwise a conversation outside the caller's
 * bucket.
 */
export const isRegularConversationReadOnly = (
  conversationId: string,
  conversations: ConversationListItemDto[],
  bucket: string,
): boolean => {
  if (!conversationId) return false;
  const listItem = conversations.find((c) => c.id.includes(conversationId));
  if (listItem) {
    return Boolean(
      listItem.isReadonly || listItem.sharedWithMe || listItem.publishedWithMe,
    );
  }
  /* Fallback: bucket-prefix check when the conversation isn't in the list yet. */
  if (!bucket) return false;
  const slashIndex = conversationId.indexOf('/');
  return slashIndex !== -1 && conversationId.slice(0, slashIndex) !== bucket;
};

/**
 * The data source of a top-level `/conversations/*` page: exactly the calls
 * `ConversationPage` made before it read them through
 * `ConversationDataSourceContext`.
 */
export const createRegularConversationDataSource = ({
  isReadOnly,
  listSync,
  watchTitle,
}: {
  isReadOnly: (id: string) => boolean;
  listSync: ConversationListSync;
  watchTitle: ConversationDataSource['watchTitle'];
}): ConversationDataSource => ({
  transport: conversationStreamTransport,
  getConversation,
  saveConversation: (path, conversation) =>
    saveConversation(path, conversation),
  handlersApi: conversationsApi,
  watchTitle,
  getConversationRoute,
  getExitRoute: () => ROUTES.Root,
  isReadOnly,
  listSync,
  canDuplicate: true,
});
