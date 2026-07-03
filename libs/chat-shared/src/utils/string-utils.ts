const encoder = new TextEncoder();

/** Returns the UTF-8 byte length of `str`. */
export const getUtf8ByteLength = (str: string): number =>
  encoder.encode(str).length;

/** Truncates `str` to at most `maxBytes` UTF-8 bytes without splitting multi-byte characters. */
export const truncateToUtf8Bytes = (str: string, maxBytes: number): string => {
  if (getUtf8ByteLength(str) <= maxBytes) return str;
  let result = '';
  let bytes = 0;
  for (const char of str) {
    const charBytes = getUtf8ByteLength(char);
    if (bytes + charBytes > maxBytes) break;
    result += char;
    bytes += charBytes;
  }
  return result;
};
