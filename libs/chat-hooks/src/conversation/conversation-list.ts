import type {
  ConversationDeletionResultDto,
  ConversationListItemDto,
  ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';

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

/** Returns `true` when a delete-all request removed nothing: some conversations failed and none was deleted or already gone. */
export const isTotalDeletionFailure = (
  result: Pick<
    ConversationDeletionResultDto,
    'failed' | 'deleted' | 'alreadyAbsent'
  >,
): boolean =>
  result.failed.length > 0 &&
  result.deleted === 0 &&
  result.alreadyAbsent === 0;

/** Returns the pin state a dragged conversation takes in its target group: `true` to pin, `false` to unpin, `undefined` to leave it. */
export const resolveConversationPinChange = (
  targetGroupKey: string,
  isPinned: boolean | undefined,
): boolean | undefined => {
  if (targetGroupKey === FilterTab.Pinned) return true;
  // A same-group reorder has no API, so only leaving the pinned group changes anything.
  return isPinned ? false : undefined;
};
