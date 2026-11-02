import { describe, expect, it } from 'vitest';
import {
  type AttachConstraintLabels,
  areAllMimeTypesAllowed,
  buildAttachConstraintDescription,
} from '../attach-constraints';

const labels: AttachConstraintLabels = {
  allTypes: 'All types',
  maxSizeWithTypes: (maxSize, types) => `Max ${maxSize}, ${types}`,
  maxSizeOnly: (maxSize) => `Max ${maxSize}`,
  upToFiles: (count) => `Up to ${count} files`,
};

describe('areAllMimeTypesAllowed', () => {
  it('is true for a wildcard entry only', () => {
    expect(areAllMimeTypesAllowed(['image/png', '*/*'])).toBe(true);
    expect(areAllMimeTypesAllowed(['*'])).toBe(true);
    expect(areAllMimeTypesAllowed(['image/*'])).toBe(false);
  });
});

describe('buildAttachConstraintDescription', () => {
  it('returns null when nothing is limited', () => {
    expect(buildAttachConstraintDescription({}, labels)).toBeNull();
    expect(
      buildAttachConstraintDescription(
        { allowedTypes: [], maxFileSize: 0, maxCount: Infinity },
        labels,
      ),
    ).toBeNull();
  });

  it('names size and types in one sentence, then the count', () => {
    expect(
      buildAttachConstraintDescription(
        {
          allowedTypes: ['*/*'],
          maxFileSize: 1024,
          maxCount: 3,
        },
        labels,
      ),
    ).toMatch(/^Max .+, All types\. Up to 3 files\.$/);
  });

  it('prefers the host label for the types', () => {
    expect(
      buildAttachConstraintDescription(
        { allowedTypes: ['image/png'], allowedTypesLabel: 'Images' },
        labels,
      ),
    ).toBe('Images.');
  });

  it('names only the size when no types are limited', () => {
    expect(
      buildAttachConstraintDescription({ maxFileSize: 2048 }, labels),
    ).toMatch(/^Max .+\.$/);
  });
});
