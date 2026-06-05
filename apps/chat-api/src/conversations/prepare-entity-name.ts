import { StringUtils } from '../common/utils/string-utils.js';

const notAllowedSymbolsRegex = /[:;,=/{}%&"]/g;
const MAX_ENTITY_BYTES = 255;

export const prepareEntityName = (prompt?: string) => {
  const clearName =
    prompt
      ?.replace(/\r\n|\r/gm, '\n')
      .split('\n')
      .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
      .filter(Boolean)[0] ?? '';

  return StringUtils.truncateToUtf8Bytes(clearName, MAX_ENTITY_BYTES);
};
