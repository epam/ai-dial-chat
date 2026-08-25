/** Decodes a percent-encoded path segment, leaving it unchanged if decoding fails. */
export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/**
 * Strips the leading bucket segment from a conversation id and decodes any
 * already-percent-encoded remainder back to raw, so callers that re-encode
 * the result once (e.g. an API client) don't double-encode it on the wire.
 */
export const getConversationPath = (conversationId: string): string => {
  const slashIndex = conversationId.indexOf('/');
  const path =
    slashIndex === -1
      ? conversationId
      : conversationId.substring(slashIndex + 1);
  return safeDecodeURI(path);
};
