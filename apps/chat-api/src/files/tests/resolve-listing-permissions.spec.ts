import { describe, expect, it } from 'vitest';
import { MARKER_NAME } from '../files.constants';
import { resolveListingPermissions } from '../resolve-listing-permissions';

describe('resolveListingPermissions', () => {
  it('returns marker permissions for the listed empty folder', () => {
    const permissions = resolveListingPermissions(
      [
        {
          name: MARKER_NAME,
          url: 'uploads/New folder 1/.dial_folder',
          permissions: ['READ', 'WRITE'],
        },
      ],
      'uploads/New folder 1/',
    );

    expect(permissions).toEqual(['READ', 'WRITE']);
  });

  it('returns undefined when marker belongs to a child folder', () => {
    const permissions = resolveListingPermissions(
      [
        {
          name: MARKER_NAME,
          url: 'uploads/New folder 1/.dial_folder',
          permissions: ['READ', 'WRITE'],
        },
      ],
      'uploads/',
    );

    expect(permissions).toBeUndefined();
  });
});
