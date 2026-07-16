export const isHiddenPath = (path: string): boolean =>
  path.split('/').some((segment) => segment.startsWith('.'));
