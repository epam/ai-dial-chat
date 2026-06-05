import { StringUtils } from '../../common/utils/string-utils.js';
import { COMPOUND_TOKEN_PREFIX } from '../constants/conversation.constants';
import type { CompoundNextToken } from '../types/conversation.types';

const notAllowedSymbolsRegex = /[:;,=/{}%&"]/g;
const MAX_ENTITY_BYTES = 255;

export const prepareEntityName = (prompt?: string): string => {
  const clearName =
    prompt
      ?.replace(/\r\n|\r/gm, '\n')
      .split('\n')
      .map((s) => s.replace(notAllowedSymbolsRegex, ' ').trim())
      .filter(Boolean)[0] ?? '';

  return StringUtils.truncateToUtf8Bytes(clearName, MAX_ENTITY_BYTES);
};

export const getConversationName = (
  defaultName: string,
  prompt?: string,
): string => prepareEntityName(prompt || defaultName);

/**
 * Extracts the human-readable title from a DIAL Core conversation filename.
 * DIAL Core stores conversations as `{deploymentId}__{title}__{uuid}`.
 * The title may itself contain `__`, so we take all segments between first and last.
 */
export const getConversationTitleFromName = (name: string): string => {
  const parts = name.split('__');
  return parts.length >= 3 ? parts.slice(1, -1).join('__') : name;
};

/**
 * Builds the new conversation path by replacing the title segment in the filename.
 * DIAL Core stores conversations as `{deploymentId}__{title}__{uuid}`.
 */
export const buildRenamedConversationPath = (
  conversationPath: string,
  sanitisedTitle: string,
): string => {
  const segments = conversationPath.split('/');
  const filename = segments[segments.length - 1];
  const parts = filename.split('__');
  const renamedFilename =
    parts.length >= 3
      ? [parts[0], sanitisedTitle, parts[parts.length - 1]].join('__')
      : sanitisedTitle;
  return segments.length > 1
    ? [...segments.slice(0, -1), renamedFilename].join('/')
    : renamedFilename;
};

// TODO: Remove this once the DIAL SDK encodes resource path segments internally.
export const encodeDialResourcePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/');

export const encodeCompoundToken = (
  userToken?: string,
  publicToken?: string,
): string | undefined => {
  if (!userToken && !publicToken) return undefined;
  const payload: CompoundNextToken = {};
  if (userToken) payload.u = userToken;
  if (publicToken) payload.p = publicToken;
  return (
    COMPOUND_TOKEN_PREFIX +
    Buffer.from(JSON.stringify(payload)).toString('base64url')
  );
};

export const decodeNextToken = (token?: string): CompoundNextToken => {
  if (!token) return {};
  if (token.startsWith(COMPOUND_TOKEN_PREFIX)) {
    try {
      return JSON.parse(
        Buffer.from(
          token.slice(COMPOUND_TOKEN_PREFIX.length),
          'base64url',
        ).toString('utf-8'),
      ) as CompoundNextToken;
    } catch {
      return {};
    }
  }
  return { u: token };
};
