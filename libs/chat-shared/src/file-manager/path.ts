/** Returns true when any path segment starts with a dot (hidden file or folder). */
export const isHiddenPath = (path: string): boolean =>
  path.split('/').some((segment) => segment.startsWith('.'));

/**
 * Returns the parent folder of a path (virtual or API), always trailing-slashed.
 *
 * @example
 * getParentFolderPath("reports/file.txt")      // "reports/"
 * getParentFolderPath("/My files/reports/")     // "/My files/"
 * getParentFolderPath("report.pdf")             // ""
 */
export const getParentFolderPath = (path: string): string => {
  const normalized = path.replace(/\/$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.slice(0, lastSlash + 1) : '';
};
