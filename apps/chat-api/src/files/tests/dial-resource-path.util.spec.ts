import { describe, expect, it } from 'vitest';
import {
  buildDialFileResourceUrl,
  buildDialFileUrl,
  encodeDialFilePath,
  toRelativePath,
} from '../dial-resource-path.util';

describe('encodeDialFilePath', () => {
  it('percent-encodes each segment while keeping separators', () => {
    expect(encodeDialFilePath('New folder/a b.pdf')).toBe(
      'New%20folder/a%20b.pdf',
    );
  });

  it('preserves a trailing slash', () => {
    expect(encodeDialFilePath('New folder/')).toBe('New%20folder/');
  });

  it('does not decode first, so a percent escape in a name survives', () => {
    expect(encodeDialFilePath('a%20b.pdf')).toBe('a%2520b.pdf');
    expect(encodeDialFilePath('a%2Fb.txt')).toBe('a%252Fb.txt');
  });

  it('returns an empty string unchanged', () => {
    expect(encodeDialFilePath('')).toBe('');
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
