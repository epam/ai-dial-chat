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

export const safeDecodeURIComponent = safeDecodeURI;

export const formatFileSize = (bytes: number): string => {
  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;
  const KB = 1024;

  if (bytes >= GB)
    return `${(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)} GB`;
  if (bytes >= MB)
    return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} MB`;
  if (bytes >= KB)
    return `${(bytes / KB).toFixed(bytes % KB === 0 ? 0 : 1)} KB`;
  return `${bytes} B`;
};
