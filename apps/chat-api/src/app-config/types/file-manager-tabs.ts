/**
 * The File Manager tab ids the client knows, in the order the client shows
 * them: the combined All tab first, then the three source tabs. Environment
 * admission, the managed value schema and the client-config normalizer all
 * use this one list.
 */
export const FILE_MANAGER_ALLOWED_TABS: readonly string[] = [
  'all',
  'my_files',
  'shared',
  'organization',
];

/** The combined tab; the client shows it only with at least two source tabs. */
export const FILE_MANAGER_ALL_TAB = 'all';
