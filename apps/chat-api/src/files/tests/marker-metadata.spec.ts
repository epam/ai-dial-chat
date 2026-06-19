import { describe, expect, it } from 'vitest';
import { MARKER_NAME } from '../files.constants';
import { markerMetadataMatches } from '../marker-metadata';

const BUCKET = 'my-bucket';

describe('markerMetadataMatches', () => {
  it('matches the exact marker path', () => {
    expect(
      markerMetadataMatches(
        {
          name: MARKER_NAME,
          url: `files/${BUCKET}/asdasd/d/New folder 1/.dial_folder`,
        },
        BUCKET,
        'asdasd/d/New folder 1/.dial_folder',
      ),
    ).toBe(true);
  });

  it('rejects parent folder marker when probing nested folder marker', () => {
    expect(
      markerMetadataMatches(
        {
          name: MARKER_NAME,
          url: `files/${BUCKET}/asdasd/d/.dial_folder`,
        },
        BUCKET,
        'asdasd/d/New folder 1/.dial_folder',
      ),
    ).toBe(false);
  });

  it('rejects folder listing metadata without marker name', () => {
    expect(
      markerMetadataMatches(
        {
          name: 'New folder 1',
          url: `files/${BUCKET}/asdasd/d/New folder 1/`,
        },
        BUCKET,
        'asdasd/d/New folder 1/.dial_folder',
      ),
    ).toBe(false);
  });
});
