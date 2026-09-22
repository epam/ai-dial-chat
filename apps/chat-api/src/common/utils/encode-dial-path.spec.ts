import { describe, expect, it } from 'vitest';
import {
  encodeDialResourcePath,
  encodePlainDialResourcePath,
} from './encode-dial-path';

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

describe('encodePlainDialResourcePath', () => {
  it('returns an empty string for an empty path', () => {
    expect(encodePlainDialResourcePath('')).toBe('');
  });

  it('encodes each segment of a nested path independently', () => {
    expect(encodePlainDialResourcePath('folder one/my file.txt')).toBe(
      'folder%20one/my%20file.txt',
    );
  });

  /*
   * The whole reason this variant exists (Issue #8974): `encodeDialResourcePath`
   * decodes first, so a folder literally named `test%20folder` collapses to
   * `test folder` and addresses a different resource.
   */
  it('escapes the percent sign of a literal percent escape in a plain name', () => {
    expect(encodePlainDialResourcePath('test%20folder')).toBe(
      'test%2520folder',
    );
    expect(encodeDialResourcePath('test%20folder')).toBe('test%20folder');
  });

  it('encodes unicode segments', () => {
    expect(encodePlainDialResourcePath('папка/файл.txt')).toBe(
      '%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0/%D1%84%D0%B0%D0%B9%D0%BB.txt',
    );
  });

  it('does not treat a literal %2F inside a segment as a path separator', () => {
    expect(encodePlainDialResourcePath('Team%2FApp One')).toBe(
      'Team%252FApp%20One',
    );
  });
});
