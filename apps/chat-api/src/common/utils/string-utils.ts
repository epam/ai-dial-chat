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
   * Strips trailing slashes from a URL or resource path.
   *
   * Scans by index instead of using a `/\/+$/` regex: repetition anchored at
   * `$` with an unanchored start makes the engine retry from every offset, so
   * a path carrying a long run of slashes costs quadratic time (CodeQL
   * js/polynomial-redos). This scan is linear regardless of input.
   */
  static stripTrailingSlashes(value: string): string {
    return StringUtils.stripTrailingChar(value, '/');
  }

  /**
   * Strips trailing occurrences of a single character. Scans by index for the
   * reason given on {@link StringUtils.stripTrailingSlashes}.
   */
  static stripTrailingChar(value: string, char: string): string {
    let end = value.length;
    while (end > 0 && value[end - 1] === char) end -= 1;
    return value.slice(0, end);
  }

  /**
   * Strips leading and trailing occurrences of a single character. Scans by
   * index for the reason given on {@link StringUtils.stripTrailingSlashes}.
   */
  static stripSurroundingChar(value: string, char: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === char) start += 1;
    while (end > start && value[end - 1] === char) end -= 1;
    return value.slice(start, end);
  }

  /**
   * Strips control characters (C0 + C1, including newlines/CR and NEL
   * (U+0085), all of which log aggregators can treat as line separators)
   * and Unicode bidi-override/zero-width codepoints (which can spoof log
   * lines the same way they can spoof filenames, see
   * `conversation.utils.ts`'s `notAllowedSymbolsRegex`), then truncates to
   * a bounded length. Intended for short, bounded-in-practice inputs
   * (model names, event type labels) — the input is pre-truncated to a
   * generous multiple of `maxLength` before the regex runs, so an
   * unexpectedly huge input can't turn this into an unbounded scan.
   */
  static sanitizeForLog(str: string, maxLength = 200): string {
    const controlAndBidiOverrideChars = new RegExp(
      '[\\x00-\\x1F\\x7F-\\x9F' +
        '\\u200B\\u200E\\u200F' +
        '\\u202A-\\u202E' +
        '\\u2066-\\u2069]',
      'gu',
    );
    return str
      .slice(0, maxLength * 4)
      .replace(controlAndBidiOverrideChars, '')
      .slice(0, maxLength);
  }
}
