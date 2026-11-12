/** The File Manager tab ids the client knows. */
export const FILE_MANAGER_ALLOWED_TABS: readonly string[] = [
  'all',
  'my_files',
  'shared',
  'organization',
];

/**
 * Admits `FILE_MANAGER_AVAILABLE_TABS` against the fixed allow-list, dropping
 * unknown ids silently. An unset or empty list, or one with no known id,
 * resolves to `undefined` so the registry default (every tab) applies.
 */
export const admitFileManagerTabs = (
  tabs: readonly string[] | undefined,
): string[] | undefined => {
  if (!tabs?.length) return undefined;
  const filtered = tabs.filter((tab) =>
    FILE_MANAGER_ALLOWED_TABS.includes(tab),
  );
  if (!filtered.length) return undefined;
  return filtered;
};
