import { describe, expect, it } from 'vitest';
import { encodeDialResourcePath } from './encode-dial-path';

describe('encodeDialResourcePath', () => {
  it('returns an empty string for an empty path', () => {
    expect(encodeDialResourcePath('')).toBe('');
  });

  it('encodes a single segment', () => {
    expect(encodeDialResourcePath('my file.txt')).toBe('my%20file.txt');
  });

  it('encodes each segment of a nested path independently', () => {
    expect(encodeDialResourcePath('folder one/my file.txt')).toBe(
      'folder%20one/my%20file.txt',
    );
  });

  it('does not double-encode already-encoded segments', () => {
    expect(encodeDialResourcePath('my%20file.txt')).toBe('my%20file.txt');
  });

  it('encodes unicode segments', () => {
    expect(encodeDialResourcePath('папка/файл.txt')).toBe(
      '%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0/%D1%84%D0%B0%D0%B9%D0%BB.txt',
    );
  });

  it('preserves a literal %2F inside a segment (does not treat it as a path separator)', () => {
    expect(encodeDialResourcePath('Team%2FApp One')).toBe('Team%2FApp%20One');
  });
});
