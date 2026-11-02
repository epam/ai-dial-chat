import type { ConversationDeletionResultDto } from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';

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
