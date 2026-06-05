/**
 * Extracts the human-readable title from a DIAL Core conversation filename.
 * DIAL Core stores conversations as `{deploymentId}__{title}__{uuid}`.
 * The title may itself contain `__`, so we take all segments between first and last.
 */
export const getConversationTitleFromName = (name: string): string => {
  const parts = name.split('__');
  return parts.length >= 3 ? parts.slice(1, -1).join('__') : name;
};
