import { describe, expect, it } from 'vitest';

import { getStorageSafeUniqueApplicationName } from '../application';

describe('Application utility methods', () => {
  it('keeps name within segment limit including version suffix', () => {
    expect(
      getStorageSafeUniqueApplicationName({
        application: {
          folderId: 'applications',
          name: 'Untitled app',
          version: '0.0.1',
        },
        desiredName: 'abcdef',
        existingNames: [],
        limits: { maxSegmentBytes: 10 },
      }),
    ).toBe('abc');
  });
});
