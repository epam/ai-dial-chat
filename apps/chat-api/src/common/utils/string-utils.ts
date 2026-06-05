export class StringUtils {
  static getUtf8ByteLength(str: string): number {
    return new TextEncoder().encode(str).byteLength;
  }

  static truncateToUtf8Bytes(str: string, maxBytes: number): string {
    if (StringUtils.getUtf8ByteLength(str) <= maxBytes) return str;
    const encoder = new TextEncoder();
    let result = '';
    let byteCount = 0;
    for (const char of str) {
      const charBytes = encoder.encode(char).byteLength;
      if (byteCount + charBytes > maxBytes) break;
      result += char;
      byteCount += charBytes;
    }
    return result;
  }
}
