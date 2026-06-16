/** Strips the tenant prefix while preserving percent-encoded resource segments. */
export const getConversationPath = (conversationId: string): string => {
  const slashIndex = conversationId.indexOf('/');
  return slashIndex === -1
    ? conversationId
    : conversationId.substring(slashIndex + 1);
};
