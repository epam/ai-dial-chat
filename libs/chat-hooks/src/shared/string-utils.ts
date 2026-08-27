/** Characters prohibited in conversation names: tab, ", :, ;, /, \, ,, =, {, }, %, & */
export const PROHIBITED_CONVERSATION_NAME_CHARS_RE = /[\t":;/\\,={}%&]/g;

/** Strips characters DIAL Core rejects in a conversation name. */
export const sanitizeConversationName = (name: string): string =>
  name.replace(PROHIBITED_CONVERSATION_NAME_CHARS_RE, '');

/** Strips trailing `.` characters from a name. */
export const stripTrailingDots = (name: string): string =>
  name.replace(/\.+$/, '');

/** Returns the UTF-8 byte length of a string (may exceed its character/code-unit length). */
export const getUtf8ByteLength = (str: string): number =>
  new TextEncoder().encode(str).byteLength;

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
