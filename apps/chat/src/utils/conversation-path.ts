/** Strips the tenant prefix from a full conversationId to get the storage path, decoded for API use. */
export const getConversationPath = (conversationId: string): string => {
  const path = conversationId.substring(conversationId.indexOf('/') + 1);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};
