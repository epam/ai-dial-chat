/**
 * Time of a conversation's last message, in epoch milliseconds: the newest
 * parseable `timestamp` among its messages.
 * @param conversation - a conversation body, or anything with `messages`
 * @returns the newest message time, or `undefined` when no message has a valid one
 */
export const getLastMessageTime = (conversation: {
  messages?: ReadonlyArray<{ timestamp?: string }>;
}): number | undefined => {
  let latest: number | undefined;
  for (const message of conversation.messages ?? []) {
    const time = Date.parse(message.timestamp ?? '');
    if (!Number.isNaN(time) && (latest == null || time > latest)) {
      latest = time;
    }
  }
  return latest;
};

/**
 * Time of a project conversation's last change, in epoch milliseconds: the
 * later of the body's `updatedAt` and its last message. Every project write
 * stamps `updatedAt` (`ProjectConversationStore`), so it tracks the file's
 * own `updatedAt` — the personal project's order — and, unlike the file's,
 * survives the copy a publication makes. A body written before the stamp
 * carries its creation time there, so its last message decides instead.
 * @param conversation - a conversation body
 * @returns the last change time, or `undefined` when the body carries neither
 */
export const getConversationActivityTime = (conversation: {
  updatedAt?: unknown;
  messages?: ReadonlyArray<{ timestamp?: string }>;
}): number | undefined => {
  const lastMessageAt = getLastMessageTime(conversation);
  const { updatedAt } = conversation;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    return lastMessageAt;
  }
  return lastMessageAt == null ? updatedAt : Math.max(updatedAt, lastMessageAt);
};
