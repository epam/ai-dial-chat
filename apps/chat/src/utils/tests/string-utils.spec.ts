import { describe, expect, it } from 'vitest';
import {
  getUtf8ByteLength,
  PROHIBITED_CONVERSATION_NAME_CHARS_RE,
  sanitizeConversationName,
  stripTrailingDots,
} from '../string-utils';

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
  it('removes all prohibited characters from a mixed string', () => {
    expect(sanitizeConversationName('a"b:c;d/e\\f,g=h{i}j%k&l')).toBe(
      'abcdefghijkl',
    );
  });

  it('removes tab characters', () => {
    expect(sanitizeConversationName('a\tb')).toBe('ab');
  });

  it('returns an empty string when input contains only prohibited characters', () => {
    expect(sanitizeConversationName('":;/\\,={}%&\t')).toBe('');
  });

  it('leaves allowed characters unchanged', () => {
    expect(sanitizeConversationName('Hello World')).toBe('Hello World');
  });

  it('preserves other special symbols that are not prohibited', () => {
    const allowed = "!@#$^*()-_+[]|~' 123";
    expect(sanitizeConversationName(allowed)).toBe(allowed);
  });

  it('preserves dots inside the name', () => {
    expect(sanitizeConversationName('my.conversation.name')).toBe(
      'my.conversation.name',
    );
  });

  it('returns an empty string for an empty input', () => {
    expect(sanitizeConversationName('')).toBe('');
  });

  it('removes multiple occurrences of the same prohibited character', () => {
    expect(sanitizeConversationName('a::b;;c')).toBe('abc');
  });
});

describe('stripTrailingDots', () => {
  it('removes a single trailing dot', () => {
    expect(stripTrailingDots('name.')).toBe('name');
  });

  it('removes multiple trailing dots', () => {
    expect(stripTrailingDots('name...')).toBe('name');
  });

  it('preserves a dot at the start of the name', () => {
    expect(stripTrailingDots('.hiddenfile')).toBe('.hiddenfile');
  });

  it('preserves dots inside the name', () => {
    expect(stripTrailingDots('my.conv.name')).toBe('my.conv.name');
  });

  it('returns an empty string when input is only dots', () => {
    expect(stripTrailingDots('...')).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(stripTrailingDots('')).toBe('');
  });

  it('leaves a name without trailing dots unchanged', () => {
    expect(stripTrailingDots('hello')).toBe('hello');
  });
});

describe('getUtf8ByteLength', () => {
  it('returns the byte length of an ASCII string', () => {
    expect(getUtf8ByteLength('hello')).toBe(5);
  });

  it('returns 0 for an empty string', () => {
    expect(getUtf8ByteLength('')).toBe(0);
  });

  it('counts multi-byte characters correctly', () => {
    // '€' is 3 bytes in UTF-8
    expect(getUtf8ByteLength('€')).toBe(3);
  });

  it('counts emoji (4-byte) characters correctly', () => {
    // '😀' is 4 bytes in UTF-8
    expect(getUtf8ByteLength('😀')).toBe(4);
  });
});
