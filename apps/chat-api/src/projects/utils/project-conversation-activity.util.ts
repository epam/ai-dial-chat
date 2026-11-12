/**
 * Time of a conversation's last message, in epoch milliseconds: the newest
 * parseable `timestamp` among its messages. A body's own `updatedAt` is set
 * at creation only, and a published copy resets the file's `updatedAt`, so
 * the messages are the one record of activity that survives the copy.
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
