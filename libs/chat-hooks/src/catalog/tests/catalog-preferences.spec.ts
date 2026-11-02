import { CatalogSortKey } from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import {
  parseCatalogFilterTopics,
  resolveCatalogActiveTab,
  resolveCatalogSortKey,
} from '../catalog-preferences';

describe('resolveCatalogSortKey', () => {
  it('keeps a known sort key', () => {
    expect(resolveCatalogSortKey(CatalogSortKey.RecentlyUpdated)).toBe(
      CatalogSortKey.RecentlyUpdated,
    );
  });

  it('falls back to recently updated for an unknown or malformed value', () => {
    expect(resolveCatalogSortKey('removed-key')).toBe(
      CatalogSortKey.RecentlyUpdated,
    );
    expect(resolveCatalogSortKey(42)).toBe(CatalogSortKey.RecentlyUpdated);
  });
});

describe('parseCatalogFilterTopics', () => {
  it('keeps only the string topics', () => {
    expect(parseCatalogFilterTopics(['public', 7, 'mine'])).toEqual(
      new Set(['public', 'mine']),
    );
  });

  it('returns an empty set for a non-array value', () => {
    expect(parseCatalogFilterTopics('public')).toEqual(new Set());
    expect(parseCatalogFilterTopics(null)).toEqual(new Set());
  });
});

describe('resolveCatalogActiveTab', () => {
  it('keeps a stored tab that is still available', () => {
    expect(resolveCatalogActiveTab('prompt', ['model', 'prompt'])).toBe(
      'prompt',
    );
  });

  it('falls back to the first available tab', () => {
    expect(resolveCatalogActiveTab('toolset', ['model', 'prompt'])).toBe(
      'model',
    );
    expect(resolveCatalogActiveTab(null, ['model'])).toBe('model');
  });

  it('returns undefined when no tab is available', () => {
    expect(resolveCatalogActiveTab('model', [])).toBeUndefined();
  });
});
