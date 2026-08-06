import { describe, expect, it } from 'vitest';
import { StringUtils } from './string-utils';

describe('StringUtils', () => {
  describe('sanitizeForLog', () => {
    it('strips control characters that could forge extra log lines', () => {
      const result = StringUtils.sanitizeForLog(
        'my-app\nfake log line injected\r\x07',
      );

      expect(result).toBe('my-appfake log line injected');
    });

    it('truncates to the default max length of 200 characters', () => {
      const result = StringUtils.sanitizeForLog('a'.repeat(500));

      expect(result).toHaveLength(200);
    });

    it('truncates to a custom max length', () => {
      const result = StringUtils.sanitizeForLog('a'.repeat(100), 10);

      expect(result).toHaveLength(10);
    });

    it('leaves an already-safe string unchanged', () => {
      const result = StringUtils.sanitizeForLog('gpt-4o');

      expect(result).toBe('gpt-4o');
    });
  });
});
