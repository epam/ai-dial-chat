const notAllowedSymbolsRegex = /[:;,=/{}%&"]/g;
const MAX_ENTITY_LENGTH = 200;

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
