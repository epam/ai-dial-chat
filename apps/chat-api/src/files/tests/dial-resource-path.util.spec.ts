import { describe, expect, it } from 'vitest';
import {
  buildDialFileResourceUrl,
  buildDialFileUrl,
  encodeDialFilePath,
  toRelativePath,
} from '../dial-resource-path.util';

describe('encodeDialFilePath', () => {
  it.each([
    [
      'percent-encodes each segment while keeping separators',
      { path: 'New folder/a b.pdf', expected: 'New%20folder/a%20b.pdf' },
    ],
    [
      'preserves a trailing slash',
      { path: 'New folder/', expected: 'New%20folder/' },
    ],
    ['returns an empty string unchanged', { path: '', expected: '' }],
  ])('%s', (_name, { path, expected }) => {
    expect(encodeDialFilePath(path)).toBe(expected);
  });

  it('does not decode first, so a percent escape in a name survives', () => {
    expect(encodeDialFilePath('a%20b.pdf')).toBe('a%2520b.pdf');
    expect(encodeDialFilePath('a%2Fb.txt')).toBe('a%252Fb.txt');
  });
});

describe('buildDialFileUrl', () => {
  it('prefixes the relative path with files/{bucket}', () => {
    expect(buildDialFileUrl('user-bucket', 'reports/q1.pdf')).toBe(
      'files/user-bucket/reports/q1.pdf',
    );
  });
});

describe('buildDialFileResourceUrl', () => {
  it('percent-encodes the path without decoding it first', () => {
    expect(
      buildDialFileResourceUrl('user-bucket', 'New folder/a%20b.pdf'),
    ).toBe('files/user-bucket/New%20folder/a%2520b.pdf');
  });
});

describe('toRelativePath', () => {
  it('strips the files/{bucket}/ prefix', () => {
    expect(
      toRelativePath('files/user-bucket/reports/q1.pdf', 'user-bucket'),
    ).toBe('reports/q1.pdf');
  });

  it('returns the path unchanged when the bucket does not match', () => {
    expect(toRelativePath('files/other/reports/q1.pdf', 'user-bucket')).toBe(
      'files/other/reports/q1.pdf',
    );
  });
});
