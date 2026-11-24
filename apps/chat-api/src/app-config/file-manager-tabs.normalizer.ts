import {
  FILE_MANAGER_ALL_TAB,
  FILE_MANAGER_ALLOWED_TABS,
} from './types/file-manager-tabs';

/* All combines the source tabs, so with fewer than two it would only repeat one. */
const MIN_SOURCE_TABS_FOR_ALL = 2;

/**
 * Normalizes the resolved `fileManager.availableTabs` value, from ENV or a
 * managed snapshot, into the `fileManagerTabs` the client receives.
 *
 * The value is a set: File Manager shows its tabs in the fixed
 * `FILE_MANAGER_ALLOWED_TABS` order and uses the list only for membership, so
 * the result is that order filtered to the known ids the value contains. All
 * is dropped below two source tabs, as the client would hide it anyway. A
 * value with no source tab (for example only `all`) would leave File Manager
 * and the attach picker without a single section, so it falls back to every
 * tab, with a warning when the value was a non-empty list.
 *
 * Takes a `warn` callback rather than a logger, like the other normalizers.
 * Always returns a fresh array.
 */
export const normalizeFileManagerTabs = (
  value: unknown,
  warn: (message: string) => void,
): string[] => {
  const listed = Array.isArray(value) ? value : [];
  const enabled = FILE_MANAGER_ALLOWED_TABS.filter((tab) =>
    listed.includes(tab),
  );
  const sources = enabled.filter((tab) => tab !== FILE_MANAGER_ALL_TAB);

  if (sources.length === 0) {
    if (listed.length > 0) {
      warn(
        'fileManager.availableTabs lists no source tab (my_files, shared or organization); showing every tab',
      );
    }
    return [...FILE_MANAGER_ALLOWED_TABS];
  }
  return sources.length < MIN_SOURCE_TABS_FOR_ALL ? sources : enabled;
};
