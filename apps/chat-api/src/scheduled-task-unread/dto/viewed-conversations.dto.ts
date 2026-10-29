export interface ViewedConversations {
  version: 1;
  /** Full DIAL Core resource ids of regular chats the user has seen. */
  conversationIds: string[];
}

export const DEFAULT_VIEWED_CONVERSATIONS: ViewedConversations = {
  version: 1,
  conversationIds: [],
};

export const parseViewedConversations = (raw: unknown): ViewedConversations => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_VIEWED_CONVERSATIONS };
  }
  const ids = (raw as Record<string, unknown>)['conversationIds'];
  return {
    version: 1,
    conversationIds: Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [],
  };
};
