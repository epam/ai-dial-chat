/** Strips the tenant prefix from a full conversationId to get the storage path. */
export const getConversationPath = (conversationId: string): string =>
  conversationId.substring(conversationId.indexOf('/') + 1);
