import { describe, expect, it } from 'vitest';
import { parseJsonObject } from '../json';

describe('parseJsonObject', () => {
  it('returns a parsed object', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonObject('{oops')).toBeUndefined();
  });

  it('returns undefined for arrays and scalars', () => {
    expect(parseJsonObject('[1]')).toBeUndefined();
    expect(parseJsonObject('3')).toBeUndefined();
    expect(parseJsonObject('null')).toBeUndefined();
  });
});
