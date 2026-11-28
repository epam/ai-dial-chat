import { describe, expect, it } from 'vitest';
import { getNameWithoutExtension } from '../attachment';

describe('getNameWithoutExtension', () => {
  it.each([
    [
      'removes extension from a file name',
      { name: 'report.pdf', expected: 'report' },
    ],
    ['keeps hidden files unchanged', { name: '.env', expected: '.env' }],
    [
      'keeps names without extension unchanged',
      { name: 'README', expected: 'README' },
    ],
    [
      'uses the last dot for names with multiple dots',
      { name: 'archive.tar.gz', expected: 'archive.tar' },
    ],
    ['removes trailing dot', { name: 'name.', expected: 'name' }],
  ])('%s', (_name, { name, expected }) => {
    expect(getNameWithoutExtension(name)).toBe(expected);
  });

  it('returns an empty string for null', () => {
    expect(getNameWithoutExtension(null as unknown as string)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(getNameWithoutExtension(undefined as unknown as string)).toBe('');
  });
});
