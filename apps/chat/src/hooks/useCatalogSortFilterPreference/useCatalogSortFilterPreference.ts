import { CatalogSortKey } from '@epam/ai-dial-catalog';
import { useCallback, useMemo } from 'react';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

interface UseCatalogSortFilterPreferenceResult {
  sortKey: CatalogSortKey;
  setSortKey: (key: CatalogSortKey) => void;
  filterTopics: Set<string>;
  setFilterTopics: (topics: Set<string>) => void;
}

/**
 * Persists the Catalog page's sort key and "From" topic filter selection to
 * `localStorage` (via `useLocalStorage`) so they survive reloads. Lives at
 * the app edge because `libs/catalog` must not access browser storage
 * directly (library isolation).
 */
export const useCatalogSortFilterPreference =
  (): UseCatalogSortFilterPreferenceResult => {
    const [storedSortKey, setStoredSortKey] = useLocalStorage<string>(
      StorageKey.CatalogSortKey,
      CatalogSortKey.RecentlyUpdated,
    );
    const [storedFilterTopics, setStoredFilterTopics] = useLocalStorage<
      string[]
    >(StorageKey.CatalogFilterTopics, []);

    const sortKey = Object.values(CatalogSortKey).includes(
      storedSortKey as CatalogSortKey,
    )
      ? (storedSortKey as CatalogSortKey)
      : CatalogSortKey.RecentlyUpdated;

    const filterTopics = useMemo(
      () =>
        new Set(
          Array.isArray(storedFilterTopics)
            ? storedFilterTopics.filter((topic) => typeof topic === 'string')
            : [],
        ),
      [storedFilterTopics],
    );

    const setSortKey = useCallback(
      (key: CatalogSortKey) => setStoredSortKey(key),
      [setStoredSortKey],
    );

    const setFilterTopics = useCallback(
      (topics: Set<string>) => setStoredFilterTopics(Array.from(topics)),
      [setStoredFilterTopics],
    );

    return { sortKey, setSortKey, filterTopics, setFilterTopics };
  };
