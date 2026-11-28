import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_ID_HEADER,
  buildConversationIdHeaders,
  buildProjectIdHeaders,
  encodeHeaderValue,
  PROJECT_ID_HEADER,
} from './header-value';

describe('buildProjectIdHeaders', () => {
  it('omits the header outside a project', () => {
    expect(buildProjectIdHeaders(undefined)).toEqual({});
  });

  it('sends the project id as x-project-id, percent-encoding non-Latin-1 text', () => {
    expect(buildProjectIdHeaders('projects/a1b2c3/support-quality')).toEqual({
      [PROJECT_ID_HEADER]: 'projects/a1b2c3/support-quality',
    });
    expect(
      buildProjectIdHeaders('projects/a1b2c3/Отчёт')[PROJECT_ID_HEADER],
    ).toBe('projects/a1b2c3/%D0%9E%D1%82%D1%87%D1%91%D1%82');
  });
});

describe('encodeHeaderValue', () => {
  it.each([
    ['returns an empty string unchanged', { value: '', expected: '' }],
    [
      'keeps spaces literal',
      { value: 'My Conversation', expected: 'My Conversation' },
    ],
    [
      'percent-encodes an em dash',
      { value: 'Costs — revenue', expected: 'Costs %E2%80%94 revenue' },
    ],
    [
      'percent-encodes Cyrillic text',
      { value: 'Привет', expected: '%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82' },
    ],
    [
      'percent-encodes emoji outside the BMP',
      { value: 'Hello 🙂', expected: 'Hello %F0%9F%99%82' },
    ],
    [
      'percent-encodes mathematical and currency symbols',
      { value: 'Value ≥ €100', expected: 'Value %E2%89%A5 %E2%82%AC100' },
    ],
    [
      'percent-encodes a literal % so the encoding stays reversible',
      { value: '100% sure', expected: '100%25 sure' },
    ],
    [
      'percent-encodes control characters that could split a header',
      { value: 'a\r\nb\tc', expected: 'a%0D%0Ab%09c' },
    ],
    [
      'does not throw on a lone surrogate',
      { value: 'a\uD800b', expected: 'a%EF%BF%BDb' },
    ],
  ])('%s', (_name, { value, expected }) => {
    expect(encodeHeaderValue(value)).toBe(expected);
  });

  it('leaves a plain-ASCII conversation id byte-identical', () => {
    const id =
      'a1b2c3/gpt-4o__My Conversation__11111111-1111-1111-1111-111111111111';
    expect(encodeHeaderValue(id)).toBe(id);
  });

  it('round-trips through decodeURIComponent', () => {
    const id = 'a1b2c3/gpt-4o__Привет — 100% 🙂__uuid';
    expect(decodeURIComponent(encodeHeaderValue(id))).toBe(id);
  });

  it('produces a value Headers accepts for every reported character class', () => {
    const value = encodeHeaderValue('Привет Hello 🙂 Value ≥ 10 Price: €100 —');
    const headers = new Headers();
    expect(() => headers.set(CONVERSATION_ID_HEADER, value)).not.toThrow();
    expect(headers.get(CONVERSATION_ID_HEADER)).toBe(value);
  });
});

describe('buildConversationIdHeaders', () => {
  it('omits the header when no conversation id is given', () => {
    expect(buildConversationIdHeaders()).toEqual({});
  });

  it('omits the header for an empty conversation id', () => {
    expect(buildConversationIdHeaders('')).toEqual({});
  });

  it('encodes the conversation id under the DIAL Core header name', () => {
    expect(buildConversationIdHeaders('bucket/gpt-4o__Привет__uuid')).toEqual({
      [CONVERSATION_ID_HEADER]:
        'bucket/gpt-4o__%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82__uuid',
    });
  });
});
