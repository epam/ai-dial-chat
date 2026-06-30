const encoder = new TextEncoder();

/** Truncates `str` to at most `maxBytes` UTF-8 bytes without splitting multi-byte characters. */
export const truncateToUtf8Bytes = (str: string, maxBytes: number): string => {
  if (encoder.encode(str).length <= maxBytes) return str;
  let result = '';
  let bytes = 0;
  for (const char of str) {
    const charBytes = encoder.encode(char).length;
    if (bytes + charBytes > maxBytes) break;
    result += char;
    bytes += charBytes;
  }
  return result;
};
