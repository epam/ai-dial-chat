import { describe, expect, it } from 'vitest';
import { StringUtils } from './string-utils';

describe('StringUtils', () => {
  describe('stripTrailingSlashes', () => {
    it('removes a single trailing slash', () => {
      expect(StringUtils.stripTrailingSlashes('http://core/v1/')).toBe(
        'http://core/v1',
      );
    });

    it('removes repeated trailing slashes', () => {
      expect(StringUtils.stripTrailingSlashes('folder///')).toBe('folder');
    });

    it('preserves slashes inside and at the start of the value', () => {
      expect(StringUtils.stripTrailingSlashes('//a/b/c')).toBe('//a/b/c');
    });

    it('returns an empty string when the value is only slashes', () => {
      expect(StringUtils.stripTrailingSlashes('////')).toBe('');
    });

    it('returns an empty string for an empty value', () => {
      expect(StringUtils.stripTrailingSlashes('')).toBe('');
    });

    it('leaves a value without trailing slashes unchanged', () => {
      expect(StringUtils.stripTrailingSlashes('folder/file.txt')).toBe(
        'folder/file.txt',
      );
    });

    it('handles a long run of trailing slashes in linear time', () => {
      expect(
        StringUtils.stripTrailingSlashes(`folder${'/'.repeat(100_000)}`),
      ).toBe('folder');
    });
  });

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
