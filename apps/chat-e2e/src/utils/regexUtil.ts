export class RegexUtil {
  static escapeRegexChars(str: string): string {
    return str.replace(/[-/\\^$*+?.()|[\]{}']/g, '\\$&');
  }

  static escapeSelectorValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
