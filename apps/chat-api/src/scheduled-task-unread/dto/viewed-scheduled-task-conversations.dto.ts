export interface ViewedScheduledTaskConversations {
  version: 1;
  conversationIds: string[];
}

export const DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS: ViewedScheduledTaskConversations =
  {
    version: 1,
    conversationIds: [],
  };

export const parseViewedScheduledTaskConversations = (
  raw: unknown,
): ViewedScheduledTaskConversations => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS };
  }

  const obj = raw as Record<string, unknown>;
  const conversationIds = Array.isArray(obj['conversationIds'])
    ? (obj['conversationIds'] as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : [];

  return { version: 1, conversationIds };
};
