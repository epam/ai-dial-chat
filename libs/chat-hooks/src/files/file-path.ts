/** True when any segment of `path` starts with a dot (a hidden file or folder). */
export const isHiddenPath = (path: string): boolean =>
  path.split('/').some((segment) => segment.startsWith('.'));
