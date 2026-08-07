import { describe, expect, it } from 'vitest';
import { computeItemOwnershipFlags } from './resource-ownership';

describe('computeItemOwnershipFlags', () => {
  it('sets isMy=true when bucket matches the second path segment', () => {
    const result = computeItemOwnershipFlags(
      'applications/BUCKET_HASH/my-app',
      'BUCKET_HASH',
      new Set(),
      new Set(),
    );

    expect(result).toEqual({
      isMy: true,
      canEdit: true,
      sharedWithMe: false,
    });
  });

  it('sets isMy=false when bucket does not match the second path segment', () => {
    const result = computeItemOwnershipFlags(
      'applications/OTHER_BUCKET/their-app',
      'BUCKET_HASH',
      new Set(),
      new Set(),
    );

    expect(result.isMy).toBe(false);
  });

  it('does not match a bucket that only appears in a later path segment', () => {
    /*
     * Regression: an app whose *name* segment happens to equal another
     * user's bucket hash must not be misclassified as owned by that bucket.
     */
    const result = computeItemOwnershipFlags(
      'applications/OTHER_BUCKET/BUCKET_HASH',
      'BUCKET_HASH',
      new Set(),
      new Set(),
    );

    expect(result.isMy).toBe(false);
  });

  it('sets isMy=false for a root-level id with no bucket segment', () => {
    const result = computeItemOwnershipFlags(
      'gpt-4o',
      'BUCKET_HASH',
      new Set(),
      new Set(),
    );

    expect(result.isMy).toBe(false);
  });

  it('sets canEdit=true when the item is in the writable set, even when not owned', () => {
    const itemId = 'applications/OTHER_BUCKET/their-app';
    const result = computeItemOwnershipFlags(
      itemId,
      'BUCKET_HASH',
      new Set([itemId]),
      new Set(),
    );

    expect(result).toEqual({
      isMy: false,
      canEdit: true,
      sharedWithMe: false,
    });
  });

  it('sets sharedWithMe=true when the item is in the shared set and not owned', () => {
    const itemId = 'applications/OTHER_BUCKET/their-app';
    const result = computeItemOwnershipFlags(
      itemId,
      'BUCKET_HASH',
      new Set(),
      new Set([itemId]),
    );

    expect(result).toEqual({
      isMy: false,
      canEdit: false,
      sharedWithMe: true,
    });
  });

  it('sets sharedWithMe=false when the item is owned, even if also present in the shared set', () => {
    const itemId = 'applications/BUCKET_HASH/my-app';
    const result = computeItemOwnershipFlags(
      itemId,
      'BUCKET_HASH',
      new Set(),
      new Set([itemId]),
    );

    expect(result.isMy).toBe(true);
    expect(result.sharedWithMe).toBe(false);
  });

  it('sets isMy=false when bucket is an empty string', () => {
    const result = computeItemOwnershipFlags(
      'applications//my-app',
      '',
      new Set(),
      new Set(),
    );

    expect(result.isMy).toBe(false);
  });
});
