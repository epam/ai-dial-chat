import { describe, expect, it } from 'vitest';
import { StringUtils } from './string-utils';

describe('StringUtils', () => {
  describe('sanitizeForLog', () => {
    it('strips C0 control characters that could forge extra log lines', () => {
      const result = StringUtils.sanitizeForLog(
        'my-app\nfake log line injected\r\x07',
      );

      expect(result).toBe('my-appfake log line injected');
    });

    it('strips C1 control characters, including NEL (U+0085)', () => {
      const result = StringUtils.sanitizeForLog('my-app\u0085fake log line');

      expect(result).toBe('my-appfake log line');
    });

    it('strips Unicode bidi-override and zero-width codepoints', () => {
      const result = StringUtils.sanitizeForLog(
        'my\u200B-\u202Eapp\u2066\u200E\u200F',
      );

      expect(result).toBe('my-app');
    });

    it('truncates to the default max length of 200 characters, keeping the leading prefix', () => {
      const result = StringUtils.sanitizeForLog('a'.repeat(500));

      expect(result).toBe('a'.repeat(200));
    });

    it('truncates to a custom max length, keeping the leading prefix', () => {
      const result = StringUtils.sanitizeForLog(
        `${'a'.repeat(10)}${'b'.repeat(90)}`,
        10,
      );

      expect(result).toBe('a'.repeat(10));
    });

    it('leaves an already-safe string unchanged', () => {
      const result = StringUtils.sanitizeForLog('gpt-4o');

      expect(result).toBe('gpt-4o');
    });
  });
});
