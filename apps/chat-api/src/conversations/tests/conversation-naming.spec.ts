import { describe, expect, it } from 'vitest';
import { DIAL_STORED_FILE_NAME_MAX_BYTES } from '../../common/validators/dial-entity-name.validator';
import {
  buildNewConversation,
  buildRenamedConversationPath,
  getConversationTitleFromName,
  getConversationName,
  getConversationTitleMaxBytes,
  isApplicationDeploymentPath,
  prepareEntityName,
} from '../utils/conversation.utils';

const utf8Bytes = (value: string): number => Buffer.byteLength(value, 'utf8');

/* The first message from the "Filename too long" report: 220 ASCII characters. */
const LONG_FIRST_MESSAGE =
  'Show the outstanding amount of general government debt securities for every reporting country in the euro area broken down by fixed-rate variable-rate and inflation-linked instruments for the last four quarters in euro';

describe('conversation naming helpers', () => {
  describe('prepareEntityName', () => {
    it.each([
      [
        'should return empty string when prompt is undefined',
        { prompt: undefined, expected: '' },
      ],
      [
        'should return empty string when prompt is empty',
        { prompt: '', expected: '' },
      ],
      [
        'should return the first line of a multiline prompt',
        { prompt: 'First line\nSecond line', expected: 'First line' },
      ],
      [
        'should handle Windows line endings (\\r\\n)',
        { prompt: 'First line\r\nSecond line', expected: 'First line' },
      ],
      [
        'should handle Mac line endings (\\r)',
        { prompt: 'First line\rSecond line', expected: 'First line' },
      ],
      [
        'should trim whitespace',
        { prompt: '  Hello world  ', expected: 'Hello world' },
      ],
      [
        'should remove trailing dots rejected by DIAL Core resource names',
        { prompt: 'Hello world.', expected: 'Hello world' },
      ],
      [
        'should trim whitespace left after removing trailing dots',
        { prompt: 'Hello world .', expected: 'Hello world' },
      ],
      [
        'should filter out empty lines and use first non-empty line',
        { prompt: '\n\nHello world\nAnother line', expected: 'Hello world' },
      ],
      [
        'should strip null bytes',
        { prompt: 'Hello\u0000world', expected: 'Hello world' },
      ],
      [
        'should strip Unicode bidi override characters',
        { prompt: 'Hello‮world', expected: 'Hello world' },
      ],
      [
        'should strip Unicode bidi embedding codepoints',
        { prompt: '‪Hello‬world‫', expected: 'Hello world' },
      ],
      [
        'should strip Unicode bidi isolate codepoints',
        { prompt: '⁦Hello⁩world', expected: 'Hello world' },
      ],
    ])('%s', (_name, { prompt, expected }) => {
      const result = prepareEntityName(prompt);
      expect(result).toBe(expected);
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

    it('truncates to a smaller byte limit when one is given', () => {
      expect(prepareEntityName('a'.repeat(300), 100)).toBe('a'.repeat(100));
    });

    it('truncates multi-byte input to a given limit on a character boundary', () => {
      // 33 × 3 = 99 bytes; a 34th '日' would make 102
      expect(prepareEntityName('日'.repeat(100), 100)).toBe('日'.repeat(33));
    });

    it('returns an empty title for a zero byte limit', () => {
      expect(prepareEntityName('Hello', 0)).toBe('');
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
    it.each([
      [
        'should use prompt if provided',
        {
          defaultName: 'Default Name',
          prompt: 'Custom prompt',
          expected: 'Custom prompt',
        },
      ],
      [
        'should use defaultName if prompt is not provided',
        {
          defaultName: 'Default Name',
          prompt: undefined,
          expected: 'Default Name',
        },
      ],
      [
        'should use defaultName if prompt contains only whitespace',
        {
          defaultName: 'Default Name',
          prompt: '   \n ',
          expected: 'Default Name',
        },
      ],
      [
        'should use defaultName if prompt contains only dots',
        {
          defaultName: 'Default Name',
          prompt: '...',
          expected: 'Default Name',
        },
      ],
      [
        'should apply name cleaning to defaultName when prompt is not provided',
        {
          defaultName: 'Default :Name;',
          prompt: undefined,
          expected: 'Default  Name',
        },
      ],
      [
        'should apply name cleaning to prompt when provided',
        {
          defaultName: 'Default Name',
          prompt: 'Custom :prompt; with "special" chars',
          expected: 'Custom  prompt  with  special  chars',
        },
      ],
    ])('%s', (_name, { defaultName, prompt, expected }) => {
      const result = getConversationName(defaultName, prompt);
      expect(result).toBe(expected);
    });

    it('applies the byte limit to the prompt and to the default name', () => {
      expect(getConversationName('New chat', 'Hello world', 5)).toBe('Hello');
      expect(getConversationName('New chat', '', 3)).toBe('New');
    });
  });

  describe('getConversationTitleMaxBytes', () => {
    it('leaves room for the deployment key, both separators and the UUID', () => {
      expect(getConversationTitleMaxBytes('gpt-4o-mini1')).toBe(
        DIAL_STORED_FILE_NAME_MAX_BYTES - 12 - 4 - 36,
      );
    });

    it('counts the deployment key in UTF-8 bytes', () => {
      expect(getConversationTitleMaxBytes('модель')).toBe(
        DIAL_STORED_FILE_NAME_MAX_BYTES - 12 - 4 - 36,
      );
    });

    it('never returns a negative budget', () => {
      expect(getConversationTitleMaxBytes('a'.repeat(500))).toBe(0);
    });
  });

  describe('buildNewConversation file name length', () => {
    const build = (firstMessage: string, deploymentId: string) =>
      buildNewConversation({
        firstMessage,
        deploymentId,
        folderId: 'bucket',
        toId: (fileName) => `bucket/${fileName}`,
      });

    it.each([
      ['the reported long ASCII message', LONG_FIRST_MESSAGE],
      ['a 300-byte ASCII message', 'a'.repeat(300)],
      ['a long Cyrillic message', 'я'.repeat(200)],
      ['a long emoji message', '👋🏽'.repeat(100)],
    ])(
      'keeps the file name of %s within the stored file name limit',
      (_label, firstMessage) => {
        const { fileName, conversation } = build(firstMessage, 'gpt-4o-mini1');

        expect(utf8Bytes(fileName)).toBeLessThanOrEqual(
          DIAL_STORED_FILE_NAME_MAX_BYTES,
        );
        expect(fileName).toBe(
          `gpt-4o-mini1__${conversation.name}__${conversation.messages[0].id}`,
        );
        expect(conversation.messages[0].content).toBe(firstMessage);
      },
    );

    it('keeps a short title whole', () => {
      expect(build('What is AI?', 'gpt-4o').conversation.name).toBe(
        'What is AI?',
      );
    });

    it('counts only the last segment of an application deployment id', () => {
      const deploymentId = 'applications/catalog/support-bot__1.0.0';
      const { fileName, conversation } = build('a'.repeat(300), deploymentId);
      const lastSegment = fileName.slice(fileName.lastIndexOf('/') + 1);

      expect(fileName.startsWith('applications/catalog/')).toBe(true);
      expect(utf8Bytes(lastSegment)).toBe(DIAL_STORED_FILE_NAME_MAX_BYTES);
      expect(conversation.name).toBe(
        'a'.repeat(getConversationTitleMaxBytes('support-bot__1.0.0')),
      );
    });
  });

  describe('conversation filename parsing', () => {
    it('recognizes application deployments under a scheduled task path', () => {
      expect(
        isApplicationDeploymentPath(
          '.scheduler/schedule-id/applications/bucket',
        ),
      ).toBe(true);
      expect(isApplicationDeploymentPath('applications/bucket')).toBe(true);
      expect(isApplicationDeploymentPath('.scheduler/schedule-id')).toBe(false);
    });

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
