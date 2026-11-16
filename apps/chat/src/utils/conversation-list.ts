import type {
  ConversationListItemDto,
  ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';

/** Returns the list endpoint's id (`conversations/<bucket>/<encoded path>`) for a decoded `<bucket>/<path>` conversation id. */
export const toConversationListId = (conversationId: string): string =>
  `conversations/${conversationId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

/** Returns whether a decoded `<bucket>/<path>` conversation id lives in `bucket`. */
export const isConversationInBucket = (
  conversationId: string,
  bucket: string | undefined,
): boolean => !!bucket && conversationId.startsWith(`${bucket}/`);

/** Returns the list row for a conversation in the user's own bucket, titled `title`. */
export const toOwnConversationListItem = (
  conversationId: string,
  conversation: Pick<ConversationResponseDto, 'updatedAt'>,
  title: string,
): ConversationListItemDto => ({
  id: toConversationListId(conversationId),
  title,
  updatedAt: conversation.updatedAt || Date.now(),
  sharedWithMe: false,
  publishedWithMe: false,
  isPinned: false,
  isReadonly: false,
  isScheduledTask: false,
});
