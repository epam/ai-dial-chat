import { describe, expect, it } from 'vitest';
import { fileMetadataMatchesPath } from '../file-metadata-match';

describe('fileMetadataMatchesPath', () => {
  it.each([
    [
      'matches a plain path against the percent-encoded url DIAL Core echoes',
      {
        url: 'files/user-bucket/New%20folder/a.pdf',
        path: 'New folder/a.pdf',
        expected: true,
      },
    ],
    [
      'ignores a trailing slash on either side',
      {
        url: 'files/user-bucket/New%20folder/',
        path: 'New folder',
        expected: true,
      },
    ],
    [
      'does not match a name whose percent escape is part of the name',
      {
        url: 'files/user-bucket/a%20b.pdf',
        path: 'a%20b.pdf',
        expected: false,
      },
    ],
    [
      'matches a name whose percent escape is part of the name when the url is double-encoded',
      {
        url: 'files/user-bucket/a%2520b.pdf',
        path: 'a%20b.pdf',
        expected: true,
      },
    ],
  ])('%s', (_name, { url, path, expected }) => {
    expect(fileMetadataMatchesPath({ url }, 'user-bucket', path)).toBe(
      expected,
    );
  });

  it('returns false when the metadata carries no url', () => {
    expect(fileMetadataMatchesPath({}, 'user-bucket', 'a.pdf')).toBe(false);
  });

  it('returns false for a non-object payload', () => {
    expect(fileMetadataMatchesPath(null, 'user-bucket', 'a.pdf')).toBe(false);
  });
});
