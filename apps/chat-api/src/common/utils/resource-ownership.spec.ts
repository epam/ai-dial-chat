import { describe, expect, it } from 'vitest';
import {
  computeItemOwnershipFlags,
  splitResourcesByPermission,
} from './resource-ownership';

describe('computeItemOwnershipFlags', () => {
  const emptyUrlSets = {
    writableUrls: new Set<string>(),
    sharedUrls: new Set<string>(),
  };

  it('sets isMy=true when bucket matches the bucket segment of a prefixed id', () => {
    const result = computeItemOwnershipFlags(
      'applications/BUCKET_HASH/my-app',
      'BUCKET_HASH',
      emptyUrlSets,
    );

    expect(result).toEqual({
      isMy: true,
      canEdit: true,
      sharedWithMe: false,
    });
  });

  it('sets isMy=false when bucket does not match the bucket segment of a prefixed id', () => {
    const result = computeItemOwnershipFlags(
      'applications/OTHER_BUCKET/their-app',
      'BUCKET_HASH',
      emptyUrlSets,
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
      emptyUrlSets,
    );

    expect(result.isMy).toBe(false);
  });

  it('sets isMy=true for a prefix-less (ambiguous root-level/copied toolset) id owned by the bucket', () => {
    /*
     * Regression: DIAL Core can return a root-level/copied toolset id
     * without the `toolsets/` prefix (`{bucket}/{name}`), where the bucket
     * is segment [0], not [1]. A naive `split('/')[1]` would read the name
     * segment instead and always report isMy=false for the owner.
     */
    const result = computeItemOwnershipFlags(
      'BUCKET_HASH/my-toolset',
      'BUCKET_HASH',
      emptyUrlSets,
    );

    expect(result.isMy).toBe(true);
  });

  it('sets isMy=false for a prefix-less id not owned by the bucket', () => {
    const result = computeItemOwnershipFlags(
      'OTHER_BUCKET/their-toolset',
      'BUCKET_HASH',
      emptyUrlSets,
    );

    expect(result.isMy).toBe(false);
  });

  it('sets isMy=false for a root-level id with no bucket segment', () => {
    const result = computeItemOwnershipFlags(
      'gpt-4o',
      'BUCKET_HASH',
      emptyUrlSets,
    );

    expect(result.isMy).toBe(false);
  });

  it('sets canEdit=true when the item is in the writable set, even when not owned', () => {
    const itemId = 'applications/OTHER_BUCKET/their-app';
    const result = computeItemOwnershipFlags(itemId, 'BUCKET_HASH', {
      writableUrls: new Set([itemId]),
      sharedUrls: new Set(),
    });

    expect(result).toEqual({
      isMy: false,
      canEdit: true,
      sharedWithMe: false,
    });
  });

  it('sets sharedWithMe=true when the item is in the shared set and not owned', () => {
    const itemId = 'applications/OTHER_BUCKET/their-app';
    const result = computeItemOwnershipFlags(itemId, 'BUCKET_HASH', {
      writableUrls: new Set(),
      sharedUrls: new Set([itemId]),
    });

    expect(result).toEqual({
      isMy: false,
      canEdit: false,
      sharedWithMe: true,
    });
  });

  it('sets sharedWithMe=false when the item is owned, even if also present in the shared set', () => {
    const itemId = 'applications/BUCKET_HASH/my-app';
    const result = computeItemOwnershipFlags(itemId, 'BUCKET_HASH', {
      writableUrls: new Set(),
      sharedUrls: new Set([itemId]),
    });

    expect(result.isMy).toBe(true);
    expect(result.sharedWithMe).toBe(false);
  });

  it('sets isMy=false when bucket is an empty string', () => {
    const result = computeItemOwnershipFlags(
      'applications//my-app',
      '',
      emptyUrlSets,
    );

    expect(result.isMy).toBe(false);
  });
});

describe('splitResourcesByPermission', () => {
  it('puts WRITE-permission resources in writableUrls', () => {
    const { writableUrls } = splitResourcesByPermission([
      { url: 'applications/b/a', permissions: ['READ', 'WRITE'] },
    ]);

    expect(writableUrls.has('applications/b/a')).toBe(true);
  });

  it('excludes READ-only resources from writableUrls', () => {
    const { writableUrls } = splitResourcesByPermission([
      { url: 'applications/b/a', permissions: ['READ'] },
    ]);

    expect(writableUrls.has('applications/b/a')).toBe(false);
  });

  it('puts every resource (regardless of permission) in sharedUrls', () => {
    const { sharedUrls } = splitResourcesByPermission([
      { url: 'applications/b/a', permissions: ['READ'] },
      { url: 'applications/b/c', permissions: ['READ', 'WRITE'] },
    ]);

    expect(sharedUrls.has('applications/b/a')).toBe(true);
    expect(sharedUrls.has('applications/b/c')).toBe(true);
  });

  it('drops resources with no url', () => {
    const { writableUrls, sharedUrls } = splitResourcesByPermission([
      { permissions: ['READ', 'WRITE'] },
    ]);

    expect(writableUrls.size).toBe(0);
    expect(sharedUrls.size).toBe(0);
  });
});
