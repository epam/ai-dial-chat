import { describe, expect, it } from 'vitest';
import {
  encodeDialResourcePath,
  encodePlainDialResourcePath,
} from './encode-dial-path';

describe('encodeDialResourcePath', () => {
  it.each([
    ['returns an empty string for an empty path', { path: '', expected: '' }],
    [
      'encodes a single segment',
      { path: 'my file.txt', expected: 'my%20file.txt' },
    ],
    [
      'encodes each segment of a nested path independently',
      {
        path: 'folder one/my file.txt',
        expected: 'folder%20one/my%20file.txt',
      },
    ],
    [
      'does not double-encode already-encoded segments',
      { path: 'my%20file.txt', expected: 'my%20file.txt' },
    ],
    [
      'encodes unicode segments',
      {
        path: 'папка/файл.txt',
        expected: '%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0/%D1%84%D0%B0%D0%B9%D0%BB.txt',
      },
    ],
    [
      'preserves a literal %2F inside a segment (does not treat it as a path separator)',
      { path: 'Team%2FApp One', expected: 'Team%2FApp%20One' },
    ],
  ])('%s', (_name, { path, expected }) => {
    expect(encodeDialResourcePath(path)).toBe(expected);
  });
});

describe('encodePlainDialResourcePath', () => {
  it.each([
    ['returns an empty string for an empty path', { path: '', expected: '' }],
    [
      'encodes each segment of a nested path independently',
      {
        path: 'folder one/my file.txt',
        expected: 'folder%20one/my%20file.txt',
      },
    ],
    [
      'encodes unicode segments',
      {
        path: 'папка/файл.txt',
        expected: '%D0%BF%D0%B0%D0%BF%D0%BA%D0%B0/%D1%84%D0%B0%D0%B9%D0%BB.txt',
      },
    ],
    [
      'does not treat a literal %2F inside a segment as a path separator',
      { path: 'Team%2FApp One', expected: 'Team%252FApp%20One' },
    ],
  ])('%s', (_name, { path, expected }) => {
    expect(encodePlainDialResourcePath(path)).toBe(expected);
  });

  /*
   * The whole reason this variant exists ([#8974](https://github.com/epam/ai-dial-chat/issues/8974)): `encodeDialResourcePath`
   * decodes first, so a folder literally named `test%20folder` collapses to
   * `test folder` and addresses a different resource.
   */
  it('escapes the percent sign of a literal percent escape in a plain name', () => {
    expect(encodePlainDialResourcePath('test%20folder')).toBe(
      'test%2520folder',
    );
    expect(encodeDialResourcePath('test%20folder')).toBe('test%20folder');
  });
});
