export {
  getUtf8ByteLength,
  sanitizeConversationName,
  stripTrailingDots,
  PROHIBITED_CONVERSATION_NAME_CHARS_RE,
} from '@epam/ai-dial-chat-shared';

/** Case-insensitive substring match. */
export const includesIgnoreCase = (str: string, query: string): boolean =>
  str.toLowerCase().includes(query.toLowerCase());

/** Decodes a URI-encoded path segment, returning the original string if decoding fails. */
export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** Alias of {@link safeDecodeURI} for call sites decoding a URI component rather than a path. */
export const safeDecodeURIComponent = safeDecodeURI;

/** Strips leading and trailing slashes from a path segment. */
export const stripSurroundingSlashes = (path: string): string =>
  path.replace(/^\/+|\/+$/g, '');
