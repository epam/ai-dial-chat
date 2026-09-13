import { describe, expect, it } from 'vitest';
import { fileMetadataMatchesPath } from '../file-metadata-match';

describe('fileMetadataMatchesPath', () => {
  it('matches a plain path against the percent-encoded url DIAL Core echoes', () => {
    expect(
      fileMetadataMatchesPath(
        { url: 'files/user-bucket/New%20folder/a.pdf' },
        'user-bucket',
        'New folder/a.pdf',
      ),
    ).toBe(true);
  });

  it('ignores a trailing slash on either side', () => {
    expect(
      fileMetadataMatchesPath(
        { url: 'files/user-bucket/New%20folder/' },
        'user-bucket',
        'New folder',
      ),
    ).toBe(true);
  });

  it('does not match a name whose percent escape is part of the name', () => {
    expect(
      fileMetadataMatchesPath(
        { url: 'files/user-bucket/a%20b.pdf' },
        'user-bucket',
        'a%20b.pdf',
      ),
    ).toBe(false);
  });

  it('matches a name whose percent escape is part of the name when the url is double-encoded', () => {
    expect(
      fileMetadataMatchesPath(
        { url: 'files/user-bucket/a%2520b.pdf' },
        'user-bucket',
        'a%20b.pdf',
      ),
    ).toBe(true);
  });

  it('returns false when the metadata carries no url', () => {
    expect(fileMetadataMatchesPath({}, 'user-bucket', 'a.pdf')).toBe(false);
  });

  it('returns false for a non-object payload', () => {
    expect(fileMetadataMatchesPath(null, 'user-bucket', 'a.pdf')).toBe(false);
  });
});
