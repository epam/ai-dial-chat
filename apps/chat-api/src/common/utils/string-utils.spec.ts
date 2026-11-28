import { describe, expect, it } from 'vitest';
import { StringUtils } from './string-utils';

describe('StringUtils', () => {
  describe('stripTrailingSlashes', () => {
    it.each([
      [
        'removes a single trailing slash',
        { value: 'http://core/v1/', expected: 'http://core/v1' },
      ],
      [
        'removes repeated trailing slashes',
        { value: 'folder///', expected: 'folder' },
      ],
      [
        'preserves slashes inside and at the start of the value',
        { value: '//a/b/c', expected: '//a/b/c' },
      ],
      [
        'returns an empty string when the value is only slashes',
        { value: '////', expected: '' },
      ],
      [
        'returns an empty string for an empty value',
        { value: '', expected: '' },
      ],
      [
        'leaves a value without trailing slashes unchanged',
        { value: 'folder/file.txt', expected: 'folder/file.txt' },
      ],
    ])('%s', (_name, { value, expected }) => {
      expect(StringUtils.stripTrailingSlashes(value)).toBe(expected);
    });

    it('handles a long run of trailing slashes in linear time', () => {
      expect(
        StringUtils.stripTrailingSlashes(`folder${'/'.repeat(100_000)}`),
      ).toBe('folder');
    });
  });

  describe('sanitizeForLog', () => {
    it.each([
      [
        'strips C0 control characters that could forge extra log lines',
        {
          value: 'my-app\nfake log line injected\r\x07',
          expected: 'my-appfake log line injected',
        },
      ],
      [
        'strips C1 control characters, including NEL (U+0085)',
        { value: 'my-app\u0085fake log line', expected: 'my-appfake log line' },
      ],
      [
        'strips Unicode bidi-override and zero-width codepoints',
        { value: 'my\u200B-\u202Eapp\u2066\u200E\u200F', expected: 'my-app' },
      ],
      [
        'leaves an already-safe string unchanged',
        { value: 'gpt-4o', expected: 'gpt-4o' },
      ],
    ])('%s', (_name, { value, expected }) => {
      const result = StringUtils.sanitizeForLog(value);

      expect(result).toBe(expected);
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
  });
});
