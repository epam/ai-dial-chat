import { describe, expect, it } from 'vitest';
import { acceptedQuality, parseAcceptEncoding } from './accept-encoding';

describe('parseAcceptEncoding', () => {
  it('reads codings with their q-values, defaulting to 1', () => {
    const codings = parseAcceptEncoding('gzip, BR;q=0.8, deflate;q=0');

    expect(Object.fromEntries(codings)).toEqual({
      gzip: 1,
      br: 0.8,
      deflate: 0,
    });
  });

  it('treats an unparsable q-value as refused', () => {
    expect(parseAcceptEncoding('br;q=abc').get('br')).toBe(0);
  });
});

describe('acceptedQuality', () => {
  it('falls back to the wildcard, then to 0', () => {
    expect(acceptedQuality(parseAcceptEncoding('*;q=0.5'), 'br')).toBe(0.5);
    expect(acceptedQuality(parseAcceptEncoding('gzip'), 'br')).toBe(0);
  });
});
