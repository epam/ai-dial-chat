const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Returns the UTF-8 byte length of `str`. */
export const getUtf8ByteLength = (str: string): number =>
  encoder.encode(str).length;

/** Truncates `str` to at most `maxBytes` UTF-8 bytes without splitting multi-byte characters. */
export const truncateToUtf8Bytes = (str: string, maxBytes: number): string => {
  const encoded = encoder.encode(str);
  if (encoded.length <= maxBytes) return str;

  // UTF-8 continuation bytes have the high bits `10xxxxxx` (0x80-0xBF);
  // back up from maxBytes to the start of the char it would otherwise split.
  let end = maxBytes;
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return decoder.decode(encoded.subarray(0, end));
};
