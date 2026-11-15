import type { ProjectConversationItemDto } from '@epam/ai-dial-chat-api-client';

/** Conversation id → its `updatedAt` when the viewer marked it viewed. */
export type ViewedMarks = Map<string, number | undefined>;

/**
 * Returns whether a listed conversation shows as unread once the viewer's
 * marks apply, and drops a mark that the listing's newer `updatedAt` outdated.
 */
export const applyViewedMark = (
  marks: ViewedMarks,
  {
    id,
    updatedAt,
    isUnread,
  }: Pick<ProjectConversationItemDto, 'id' | 'updatedAt' | 'isUnread'>,
): boolean => {
  /*
   * A conversation marked viewed stays read until a read reports a newer
   * `updatedAt` than the one it had when marked, so a read already in flight
   * cannot bring back the dot the user just cleared.
   */
  if (!marks.has(id)) return isUnread;
  const markedAt = marks.get(id);
  if (updatedAt != null && markedAt != null && updatedAt > markedAt) {
    marks.delete(id);
    return isUnread;
  }
  return false;
};
