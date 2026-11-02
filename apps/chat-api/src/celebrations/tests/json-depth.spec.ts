import { describe, expect, it } from 'vitest';
import { exceedsJsonDepth, parseBoundedJson } from '../json-depth';

const bytes = (text: string) => Buffer.from(text, 'utf8');
const nested = (depth: number) => `${'['.repeat(depth)}${']'.repeat(depth)}`;

describe('exceedsJsonDepth', () => {
  it('accepts nesting up to the limit and rejects one level more', () => {
    expect(exceedsJsonDepth(bytes(nested(32)), 32)).toBe(false);
    expect(exceedsJsonDepth(bytes(nested(33)), 32)).toBe(true);
  });

  it('counts objects and arrays together', () => {
    expect(exceedsJsonDepth(bytes('{"a":[{"b":[1]}]}'), 4)).toBe(false);
    expect(exceedsJsonDepth(bytes('{"a":[{"b":[1]}]}'), 3)).toBe(true);
  });

  it('ignores brackets inside strings', () => {
    expect(exceedsJsonDepth(bytes(`{"a":"${nested(40)}"}`), 2)).toBe(false);
  });

  it('keeps an escaped quote inside the string', () => {
    expect(exceedsJsonDepth(bytes(`["\\"${'['.repeat(10)}"]`), 1)).toBe(false);
    expect(exceedsJsonDepth(bytes('["\\\\",[[1]]]'), 2)).toBe(true);
  });

  it('rejects deep truncated input', () => {
    expect(exceedsJsonDepth(bytes('['.repeat(65)), 64)).toBe(true);
  });
});

describe('parseBoundedJson', () => {
  it('parses JSON within the limit', () => {
    expect(parseBoundedJson(bytes('{"a":[1,2]}'), 2)).toEqual({
      value: { a: [1, 2] },
    });
  });

  it('rejects deep JSON before parsing it', () => {
    expect(parseBoundedJson(bytes(nested(3)), 2)).toEqual({
      error: 'JSON nesting exceeds 2',
    });
  });

  it('rejects truncated input without quoting the body', () => {
    expect(parseBoundedJson(bytes('{"secret":"va'), 32)).toEqual({
      error: 'invalid JSON',
    });
  });

  it('rejects malformed UTF-8', () => {
    expect(parseBoundedJson(Buffer.from([0x22, 0xff, 0x22]), 32)).toEqual({
      error: 'invalid JSON',
    });
  });
});
