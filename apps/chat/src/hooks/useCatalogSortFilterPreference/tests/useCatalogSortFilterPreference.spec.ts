import { CatalogSortKey } from '@epam/ai-dial-catalog';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageKey } from '../../../types/storage-key';
import { useCatalogSortFilterPreference } from '../useCatalogSortFilterPreference';

describe('useCatalogSortFilterPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to RecentlyUpdated, an empty set, and My Apps off when nothing is persisted', () => {
    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.sortKey).toBe(CatalogSortKey.RecentlyUpdated);
    expect(result.current.filterTopics).toEqual(new Set());
    expect(result.current.isMyAppsActive).toBe(false);
  });

  it('restores a persisted sort key', () => {
    localStorage.setItem(
      StorageKey.CatalogSortKey,
      JSON.stringify(CatalogSortKey.Newest),
    );

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.sortKey).toBe(CatalogSortKey.Newest);
  });

  it('falls back to the default sort key when the persisted value is invalid', () => {
    localStorage.setItem(
      StorageKey.CatalogSortKey,
      JSON.stringify('not-a-real-key'),
    );

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.sortKey).toBe(CatalogSortKey.RecentlyUpdated);
  });

  it('restores persisted filter topics', () => {
    localStorage.setItem(
      StorageKey.CatalogFilterTopics,
      JSON.stringify(['nlp', 'vision']),
    );

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.filterTopics).toEqual(new Set(['nlp', 'vision']));
  });

  it('falls back to an empty set when persisted filter topics are malformed', () => {
    localStorage.setItem(StorageKey.CatalogFilterTopics, '{not valid json');

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.filterTopics).toEqual(new Set());
  });

  it('persists the sort key when setSortKey is called', () => {
    const { result } = renderHook(() => useCatalogSortFilterPreference());

    act(() => {
      result.current.setSortKey(CatalogSortKey.NameAZ);
    });

    expect(result.current.sortKey).toBe(CatalogSortKey.NameAZ);
    expect(localStorage.getItem(StorageKey.CatalogSortKey)).toBe(
      JSON.stringify(CatalogSortKey.NameAZ),
    );
  });

  it('persists the filter topics when setFilterTopics is called', () => {
    const { result } = renderHook(() => useCatalogSortFilterPreference());

    act(() => {
      result.current.setFilterTopics(new Set(['agents']));
    });

    expect(result.current.filterTopics).toEqual(new Set(['agents']));
    expect(localStorage.getItem(StorageKey.CatalogFilterTopics)).toBe(
      JSON.stringify(['agents']),
    );
  });

  it('does not throw and still updates in-memory state when localStorage.setItem fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    act(() => {
      result.current.setSortKey(CatalogSortKey.NameAZ);
    });

    expect(result.current.sortKey).toBe(CatalogSortKey.NameAZ);
  });

  it('restores a persisted My Apps toggle', () => {
    localStorage.setItem(
      StorageKey.CatalogIsMyAppsActive,
      JSON.stringify(true),
    );

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.isMyAppsActive).toBe(true);
  });

  it('falls back to false when the persisted My Apps value is not a boolean', () => {
    localStorage.setItem(
      StorageKey.CatalogIsMyAppsActive,
      JSON.stringify('not-a-boolean'),
    );

    const { result } = renderHook(() => useCatalogSortFilterPreference());

    expect(result.current.isMyAppsActive).toBe(false);
  });

  it('persists the My Apps toggle when setIsMyAppsActive is called', () => {
    const { result } = renderHook(() => useCatalogSortFilterPreference());

    act(() => {
      result.current.setIsMyAppsActive(true);
    });

    expect(result.current.isMyAppsActive).toBe(true);
    expect(localStorage.getItem(StorageKey.CatalogIsMyAppsActive)).toBe(
      JSON.stringify(true),
    );
  });
});
