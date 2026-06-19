// Characters prohibited in conversation names: tab, ", :, ;, /, \, ,, =, {, }, %, &
export const PROHIBITED_CONVERSATION_NAME_CHARS_RE = /[\t":;/\\,={}%&]/g;

export const sanitizeConversationName = (name: string): string =>
  name.replace(PROHIBITED_CONVERSATION_NAME_CHARS_RE, '');

export const stripTrailingDots = (name: string): string =>
  name.replace(/\.+$/, '');

export const getUtf8ByteLength = (str: string): number =>
  new TextEncoder().encode(str).byteLength;

export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};
