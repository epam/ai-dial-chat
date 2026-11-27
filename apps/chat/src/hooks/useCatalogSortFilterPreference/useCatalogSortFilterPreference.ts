import { CatalogFolderSelection, CatalogSortKey } from '@epam/ai-dial-catalog';
import {
  parseCatalogFilterTopics,
  resolveCatalogSortKey,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect, useMemo } from 'react';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';
import { parseCatalogFolderSelection } from './parse-catalog-folder-selection';

/* Key of the removed "My" filter toggle, deleted once so it does not linger. */
const REMOVED_MY_APPS_KEY = 'catalogIsMyAppsActive';

interface UseCatalogSortFilterPreferenceResult {
  sortKey: CatalogSortKey;
  setSortKey: (key: CatalogSortKey) => void;
  filterTopics: Set<string>;
  setFilterTopics: (topics: Set<string>) => void;
  folderSelection: CatalogFolderSelection;
  setFolderSelection: (selection: CatalogFolderSelection) => void;
}

/**
 * Persists the Catalog page's sort key, topic filter and folder selection to
 * `localStorage` (via `useLocalStorage`) so they survive reloads.
 * Lives at the app edge because `libs/catalog` must not access browser
 * storage directly (library isolation).
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
    const [storedFolderSelection, setStoredFolderSelection] =
      useLocalStorage<unknown>(StorageKey.CatalogFolderSelection, null);

    useEffect(() => {
      try {
        localStorage.removeItem(REMOVED_MY_APPS_KEY);
      } catch {
        // Storage may be unavailable (private mode, blocked site data).
      }
    }, []);

    const sortKey = resolveCatalogSortKey(storedSortKey);

    const filterTopics = useMemo(
      () => parseCatalogFilterTopics(storedFilterTopics),
      [storedFilterTopics],
    );

    const folderSelection = useMemo(
      () => parseCatalogFolderSelection(storedFolderSelection),
      [storedFolderSelection],
    );

    const setSortKey = useCallback(
      (key: CatalogSortKey) => setStoredSortKey(key),
      [setStoredSortKey],
    );

    const setFilterTopics = useCallback(
      (topics: Set<string>) => setStoredFilterTopics(Array.from(topics)),
      [setStoredFilterTopics],
    );

    const setFolderSelection = useCallback(
      (selection: CatalogFolderSelection) =>
        setStoredFolderSelection(selection),
      [setStoredFolderSelection],
    );

    return {
      sortKey,
      setSortKey,
      filterTopics,
      setFilterTopics,
      folderSelection,
      setFolderSelection,
    };
  };
