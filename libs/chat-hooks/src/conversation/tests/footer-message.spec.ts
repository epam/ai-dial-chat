import { describe, expect, it } from 'vitest';
import { formatAppVersion } from '../footer-message';

describe('formatAppVersion', () => {
  it.each([
    [
      'prefixes a bare version with v',
      { input: '0.45.0', expected: 'v0.45.0' },
    ],
    [
      'leaves an already-prefixed version unchanged',
      { input: 'v0.45.0', expected: 'v0.45.0' },
    ],
    [
      'leaves an uppercase-prefixed version unchanged',
      { input: 'V0.45.0', expected: 'V0.45.0' },
    ],
    [
      'trims surrounding whitespace',
      { input: '  0.45.0  ', expected: 'v0.45.0' },
    ],
    [
      'passes build-stamped pre-release versions through without parsing',
      { input: '2026.08.10-a1b2c3d', expected: 'v2026.08.10-a1b2c3d' },
    ],
  ])('%s', (_name, { input, expected }) => {
    expect(formatAppVersion(input)).toBe(expected);
  });
});
