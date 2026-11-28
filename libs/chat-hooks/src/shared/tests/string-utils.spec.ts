import {
  getUtf8ByteLength,
  PROHIBITED_CONVERSATION_NAME_CHARS_RE,
  sanitizeConversationName,
  stripTrailingDots,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { stripSurroundingSlashes, stripTrailingSlashes } from '../string-utils';

describe('PROHIBITED_CONVERSATION_NAME_CHARS_RE', () => {
  const prohibited = [
    '\t',
    '"',
    ':',
    ';',
    '/',
    '\\',
    ',',
    '=',
    '{',
    '}',
    '%',
    '&',
  ];

  it.each(prohibited)('matches prohibited character %j', (char) => {
    PROHIBITED_CONVERSATION_NAME_CHARS_RE.lastIndex = 0;
    expect(PROHIBITED_CONVERSATION_NAME_CHARS_RE.test(char)).toBe(true);
  });

  it('does not match allowed characters', () => {
    PROHIBITED_CONVERSATION_NAME_CHARS_RE.lastIndex = 0;
    expect(
      PROHIBITED_CONVERSATION_NAME_CHARS_RE.test(
        'Hello World 123 !@#$^*()-_+[]|',
      ),
    ).toBe(false);
  });
});

describe('sanitizeConversationName', () => {
  it.each([
    [
      'removes all prohibited characters from a mixed string',
      { input: 'a"b:c;d/e\\f,g=h{i}j%k&l', expected: 'abcdefghijkl' },
    ],
    ['removes tab characters', { input: 'a\tb', expected: 'ab' }],
    [
      'returns an empty string when input contains only prohibited characters',
      { input: '":;/\\,={}%&\t', expected: '' },
    ],
    [
      'leaves allowed characters unchanged',
      { input: 'Hello World', expected: 'Hello World' },
    ],
    [
      'preserves dots inside the name',
      { input: 'my.conversation.name', expected: 'my.conversation.name' },
    ],
    ['returns an empty string for an empty input', { input: '', expected: '' }],
    [
      'removes multiple occurrences of the same prohibited character',
      { input: 'a::b;;c', expected: 'abc' },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(sanitizeConversationName(input)).toBe(expected);
  });

  it('preserves other special symbols that are not prohibited', () => {
    const allowed = "!@#$^*()-_+[]|~' 123";
    expect(sanitizeConversationName(allowed)).toBe(allowed);
  });
});

describe('stripTrailingDots', () => {
  it.each([
    ['removes a single trailing dot', { input: 'name.', expected: 'name' }],
    ['removes multiple trailing dots', { input: 'name...', expected: 'name' }],
    [
      'preserves a dot at the start of the name',
      { input: '.hiddenfile', expected: '.hiddenfile' },
    ],
    [
      'preserves dots inside the name',
      { input: 'my.conv.name', expected: 'my.conv.name' },
    ],
    [
      'returns an empty string when input is only dots',
      { input: '...', expected: '' },
    ],
    ['returns an empty string for an empty input', { input: '', expected: '' }],
    [
      'leaves a name without trailing dots unchanged',
      { input: 'hello', expected: 'hello' },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(stripTrailingDots(input)).toBe(expected);
  });

  it('removes a long sequence of trailing dots', () => {
    expect(stripTrailingDots(`name${'.'.repeat(100_000)}`)).toBe('name');
  });
});

describe('stripTrailingSlashes', () => {
  it.each([
    [
      'removes a single trailing slash',
      { input: '/My files/reports/', expected: '/My files/reports' },
    ],
    [
      'removes repeated trailing slashes',
      { input: 'reports///', expected: 'reports' },
    ],
    [
      'preserves leading slashes',
      { input: '//reports', expected: '//reports' },
    ],
    [
      'returns an empty string when input is only slashes',
      { input: '////', expected: '' },
    ],
    ['returns an empty string for an empty input', { input: '', expected: '' }],
    [
      'leaves a path without trailing slashes unchanged',
      { input: 'reports/q1.pdf', expected: 'reports/q1.pdf' },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(stripTrailingSlashes(input)).toBe(expected);
  });

  it('handles a long sequence of trailing slashes in linear time', () => {
    expect(stripTrailingSlashes(`reports${'/'.repeat(100_000)}`)).toBe(
      'reports',
    );
  });
});

describe('stripSurroundingSlashes', () => {
  it.each([
    [
      'removes leading and trailing slashes',
      { input: '/reports/', expected: 'reports' },
    ],
    [
      'removes repeated slashes on both ends',
      { input: '///reports///', expected: 'reports' },
    ],
    [
      'preserves slashes inside the path',
      { input: '/reports/q1/final.pdf/', expected: 'reports/q1/final.pdf' },
    ],
    [
      'returns an empty string when input is only slashes',
      { input: '////', expected: '' },
    ],
    ['returns an empty string for an empty input', { input: '', expected: '' }],
  ])('%s', (_name, { input, expected }) => {
    expect(stripSurroundingSlashes(input)).toBe(expected);
  });

  it('handles a long sequence of surrounding slashes in linear time', () => {
    const slashes = '/'.repeat(100_000);
    expect(stripSurroundingSlashes(`${slashes}reports${slashes}`)).toBe(
      'reports',
    );
  });
});

describe('getUtf8ByteLength', () => {
  it.each([
    [
      'returns the byte length of an ASCII string',
      { input: 'hello', expected: 5 },
    ],
    ['returns 0 for an empty string', { input: '', expected: 0 }],
    // '€' is 3 bytes in UTF-8
    ['counts multi-byte characters correctly', { input: '€', expected: 3 }],
    // '😀' is 4 bytes in UTF-8
    [
      'counts emoji (4-byte) characters correctly',
      { input: '😀', expected: 4 },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(getUtf8ByteLength(input)).toBe(expected);
  });
});
