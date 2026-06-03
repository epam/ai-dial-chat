const notAllowedSymbolsRegex = /[:;,=/{}%&"]/g;

/**
 * Extracts the human-readable title from a DIAL Core conversation filename.
 * DIAL Core stores conversations as `{deploymentId}__{title}__{uuid}`.
 * The title may itself contain `__`, so we take all segments between first and last.
 */
export const getConversationTitleFromName = (name: string): string => {
  const parts = name.split('__');
  return parts.length >= 3 ? parts.slice(1, -1).join('__') : name;
};
const MAX_ENTITY_LENGTH = 200;

export const getConversationName = (defaultName: string, prompt?: string) => {
  return prepareEntityName(prompt || defaultName);
};

export const prepareEntityName = (prompt?: string) => {
  const clearName =
    prompt
      ?.replace(/\r\n|\r/gm, '\n')
      .split('\n')
      .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
      .filter(Boolean)[0] ?? '';

  const result =
    clearName.length > MAX_ENTITY_LENGTH
      ? clearName.substring(0, MAX_ENTITY_LENGTH)
      : clearName;

  return result.trim();
};
