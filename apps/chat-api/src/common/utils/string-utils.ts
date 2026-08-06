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

  /**
   * Strips control characters (including newlines/carriage returns that
   * could forge extra log lines) and truncates to a bounded length, so an
   * untrusted string can be safely embedded in a log line, error message,
   * or metrics label without enabling log injection or unbounded
   * cardinality.
   */
  static sanitizeForLog(str: string, maxLength = 200): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLength);
  }
}
