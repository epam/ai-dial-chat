export interface ConversationsReadBaseline {
  version: 1;
  /** Unix epoch milliseconds; a chat last updated at or before it counts as read. */
  readBefore: number;
}

/** Returns the stored `readBefore`, or `null` when the payload is not a valid baseline. */
export const parseConversationsReadBaseline = (raw: unknown): number | null => {
  if (raw == null || typeof raw !== 'object') return null;
  const readBefore = (raw as Record<string, unknown>)['readBefore'];
  return typeof readBefore === 'number' && Number.isFinite(readBefore)
    ? readBefore
    : null;
};
