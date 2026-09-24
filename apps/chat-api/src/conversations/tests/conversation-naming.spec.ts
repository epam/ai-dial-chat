import { describe, expect, it } from 'vitest';
import {
  buildRenamedConversationPath,
  getConversationTitleFromName,
  getConversationName,
  prepareEntityName,
} from '../utils/conversation.utils';

describe('conversation naming helpers', () => {
  describe('prepareEntityName', () => {
    it('should return empty string when prompt is undefined', () => {
      const result = prepareEntityName(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when prompt is empty', () => {
      const result = prepareEntityName('');
      expect(result).toBe('');
    });

    it('should return the first line of a multiline prompt', () => {
      const result = prepareEntityName('First line\nSecond line');
      expect(result).toBe('First line');
    });

    it('should handle Windows line endings (\\r\\n)', () => {
      const result = prepareEntityName('First line\r\nSecond line');
      expect(result).toBe('First line');
    });

    it('should handle Mac line endings (\\r)', () => {
      const result = prepareEntityName('First line\rSecond line');
      expect(result).toBe('First line');
    });

    it('should trim whitespace', () => {
      const result = prepareEntityName('  Hello world  ');
      expect(result).toBe('Hello world');
    });

    it('should remove trailing dots rejected by DIAL Core resource names', () => {
      const result = prepareEntityName('Hello world.');
      expect(result).toBe('Hello world');
    });

    it('should trim whitespace left after removing trailing dots', () => {
      const result = prepareEntityName('Hello world .');
      expect(result).toBe('Hello world');
    });

    it('should truncate ASCII input to 255 UTF-8 bytes', () => {
      const longString = 'a'.repeat(300);
      const result = prepareEntityName(longString);
      expect(result).toHaveLength(255);
      expect(result).toBe('a'.repeat(255));
    });

    it('should truncate multi-byte input on a character boundary', () => {
      // '日' is 3 UTF-8 bytes; 85 × 3 = 255 bytes, 86 × 3 = 258 bytes
      const result = prepareEntityName('日'.repeat(100));
      expect(result).toBe('日'.repeat(85));
      expect(new TextEncoder().encode(result).byteLength).toBe(255);
    });

    it('should remove trailing dots after truncation', () => {
      const result = prepareEntityName(`${'a'.repeat(254)}.ignored`);
      expect(result).toBe('a'.repeat(254));
    });

    it('should filter out empty lines and use first non-empty line', () => {
      const result = prepareEntityName('\n\nHello world\nAnother line');
      expect(result).toBe('Hello world');
    });

    it('should strip null bytes', () => {
      const result = prepareEntityName('Hello\u0000world');
      expect(result).toBe('Hello world');
    });

    it('should strip Unicode bidi override characters', () => {
      const result = prepareEntityName('Hello\u202Eworld');
      expect(result).toBe('Hello world');
    });

    it('should strip Unicode bidi embedding codepoints', () => {
      const result = prepareEntityName('\u202AHello\u202Cworld\u202B');
      expect(result).toBe('Hello world');
    });

    it('should strip Unicode bidi isolate codepoints', () => {
      const result = prepareEntityName('\u2066Hello\u2069world');
      expect(result).toBe('Hello world');
    });

    it('should strip every character DIAL Core rejects in a resource name', () => {
      /*
       * Pins the backend list against `NOT_ALLOWED_SYMBOLS` in
       * `@epam/ai-dial-ui-kit` and `PROHIBITED_CONVERSATION_NAME_CHARS_RE` in
       * `libs/chat-shared`. The backslash is the one that was missing and
       * stranded conversations.
       */
      for (const char of [
        ':',
        ';',
        ',',
        '=',
        '/',
        '\\',
        '{',
        '}',
        '%',
        '&',
        '"',
      ]) {
        expect(prepareEntityName(`a${char}b`)).toBe('a b');
      }
    });

    it('should strip tabs', () => {
      expect(prepareEntityName('Hello\tworld')).toBe('Hello world');
    });

    it('should strip backslashes from a LaTeX-style first prompt', () => {
      const result = prepareEntityName(
        'Displayed LaTeX for \\frac{1}{1+x} and \\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}',
      );

      expect(result).not.toContain('\\');
      expect(result).toBe(
        'Displayed LaTeX for  frac 1  1+x  and  begin bmatrix 1   2  3   4 end bmatrix',
      );
    });
  });

  describe('getConversationName', () => {
    it('should use prompt if provided', () => {
      const result = getConversationName('Default Name', 'Custom prompt');
      expect(result).toBe('Custom prompt');
    });

    it('should use defaultName if prompt is not provided', () => {
      const result = getConversationName('Default Name');
      expect(result).toBe('Default Name');
    });

    it('should use defaultName if prompt contains only whitespace', () => {
      const result = getConversationName('Default Name', '   \n ');
      expect(result).toBe('Default Name');
    });

    it('should use defaultName if prompt contains only dots', () => {
      const result = getConversationName('Default Name', '...');
      expect(result).toBe('Default Name');
    });

    it('should apply name cleaning to defaultName when prompt is not provided', () => {
      const result = getConversationName('Default :Name;');
      expect(result).toBe('Default  Name');
    });

    it('should apply name cleaning to prompt when provided', () => {
      const result = getConversationName(
        'Default Name',
        'Custom :prompt; with "special" chars',
      );
      expect(result).toBe('Custom  prompt  with  special  chars');
    });
  });

  describe('conversation filename parsing', () => {
    it('extracts a title after a versioned application deployment ID', () => {
      expect(
        getConversationTitleFromName(
          'Team%2FApp%20One__0.0.1__My conversation',
          true,
        ),
      ).toBe('My conversation');
    });

    it('supports the legacy arbitrary suffix format', () => {
      expect(
        getConversationTitleFromName('gpt-4__title__legacy-id', false),
      ).toBe('title');
    });

    it('does not mistake a bare-numeric title for a version suffix on a plain model deployment', () => {
      expect(
        getConversationTitleFromName(
          'gemini-3.1-flash-lite__18__0e2c7332-bf11-4026-b729-502b55bbbb77',
          false,
        ),
      ).toBe('18');
    });

    it('preserves a versioned deployment ID when renaming', () => {
      expect(
        buildRenamedConversationPath(
          'applications/catalog/Team%2FApp%20One__0.0.1__old',
          'new',
        ),
      ).toBe('applications/catalog/Team%2FApp%20One__0.0.1__new');
    });

    it('preserves a legacy UUID suffix when renaming', () => {
      expect(
        buildRenamedConversationPath(
          'gpt-4__old__123e4567-e89b-42d3-a456-426614174000',
          'new',
        ),
      ).toBe('gpt-4__new__123e4567-e89b-42d3-a456-426614174000');
    });
  });
});
