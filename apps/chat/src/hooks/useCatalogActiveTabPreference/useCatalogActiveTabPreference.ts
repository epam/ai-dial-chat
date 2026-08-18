import { useCallback } from 'react';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

interface UseCatalogActiveTabPreferenceResult {
  activeTab: string | undefined;
  setActiveTab: (tabId: string) => void;
}

/**
 * Persists the Catalog page's active entity-type tab to `localStorage` (via
 * `useLocalStorage`) so it survives reloads and edit-flow round-trips. Lives
 * at the app edge because `libs/catalog` must not access browser storage
 * directly (library isolation).
 */
export const useCatalogActiveTabPreference = (
  availableTabIds: string[],
): UseCatalogActiveTabPreferenceResult => {
  const [storedActiveTab, setStoredActiveTab] = useLocalStorage<string | null>(
    StorageKey.CatalogActiveTab,
    null,
  );

  const activeTab = availableTabIds.includes(storedActiveTab ?? '')
    ? (storedActiveTab as string)
    : availableTabIds[0];

  const setActiveTab = useCallback(
    (tabId: string) => setStoredActiveTab(tabId),
    [setStoredActiveTab],
  );

  return { activeTab, setActiveTab };
};
