import { Feature } from '../../types/features';
import { validateFeature } from '../features';

import { test } from 'vitest';

describe('validateFeature', () => {
  test('should return true when feature is available', () => {
    const feature = Feature.AttachmentsManager;
    const result = validateFeature(feature);
    expect(result).toBe(true);
  });

  test('should return false when feature is not available', () => {
    const feature = 'nonExistentFeature';
    const result = validateFeature(feature);
    expect(result).toBe(false);
  });
});
