export interface ViewedConversations {
  version: 1;
  /** Full DIAL Core resource ids of regular chats the user has seen. */
  conversationIds: string[];
  /**
   * Project chats the user has seen: project id → (conversation locator →
   * the content version seen). A newer version of the chat is unread again.
   */
  projectConversationIds: Record<string, Record<string, string>>;
}

export const DEFAULT_VIEWED_CONVERSATIONS: ViewedConversations = {
  version: 1,
  conversationIds: [],
  projectConversationIds: {},
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

/* Keeps every well-formed project entry; a malformed one is dropped rather than failing the whole file. */
const parseProjectConversationIds = (
  raw: unknown,
): Record<string, Record<string, string>> => {
  if (!isPlainObject(raw)) return {};
  const projects: Record<string, Record<string, string>> = {};
  for (const [projectId, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry)) continue;
    const versions: Record<string, string> = {};
    for (const [conversationId, version] of Object.entries(entry)) {
      if (typeof version === 'string') versions[conversationId] = version;
    }
    if (Object.keys(versions).length > 0) projects[projectId] = versions;
  }
  return projects;
};

export const parseViewedConversations = (raw: unknown): ViewedConversations => {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_VIEWED_CONVERSATIONS, projectConversationIds: {} };
  }
  const record = raw as Record<string, unknown>;
  const ids = record['conversationIds'];
  return {
    version: 1,
    conversationIds: Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [],
    projectConversationIds: parseProjectConversationIds(
      record['projectConversationIds'],
    ),
  };
};
