import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_ID_HEADER,
  buildConversationIdHeaders,
  encodeHeaderValue,
} from './header-value';

describe('encodeHeaderValue', () => {
  it('returns an empty string unchanged', () => {
    expect(encodeHeaderValue('')).toBe('');
  });

  it('leaves a plain-ASCII conversation id byte-identical', () => {
    const id =
      'a1b2c3/gpt-4o__My Conversation__11111111-1111-1111-1111-111111111111';
    expect(encodeHeaderValue(id)).toBe(id);
  });

  it('keeps spaces literal', () => {
    expect(encodeHeaderValue('My Conversation')).toBe('My Conversation');
  });

  it('percent-encodes an em dash', () => {
    expect(encodeHeaderValue('Costs — revenue')).toBe(
      'Costs %E2%80%94 revenue',
    );
  });

  it('percent-encodes Cyrillic text', () => {
    expect(encodeHeaderValue('Привет')).toBe(
      '%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82',
    );
  });

  it('percent-encodes emoji outside the BMP', () => {
    expect(encodeHeaderValue('Hello 🙂')).toBe('Hello %F0%9F%99%82');
  });

  it('percent-encodes mathematical and currency symbols', () => {
    expect(encodeHeaderValue('Value ≥ €100')).toBe(
      'Value %E2%89%A5 %E2%82%AC100',
    );
  });

  it('percent-encodes a literal % so the encoding stays reversible', () => {
    expect(encodeHeaderValue('100% sure')).toBe('100%25 sure');
  });

  it('round-trips through decodeURIComponent', () => {
    const id = 'a1b2c3/gpt-4o__Привет — 100% 🙂__uuid';
    expect(decodeURIComponent(encodeHeaderValue(id))).toBe(id);
  });

  it('percent-encodes control characters that could split a header', () => {
    expect(encodeHeaderValue('a\r\nb\tc')).toBe('a%0D%0Ab%09c');
  });

  it('does not throw on a lone surrogate', () => {
    expect(encodeHeaderValue('a\uD800b')).toBe('a%EF%BF%BDb');
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
