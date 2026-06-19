export const logDialFileManagerDebug = (
  event: string,
  details?: Record<string, unknown>,
): void => {
  if (!import.meta.env.DEV) return;
  if (details != null) {
    console.debug(`[DialFileManager] ${event}`, details);
  } else {
    console.debug(`[DialFileManager] ${event}`);
  }
};

const summarizeCacheItems = (
  items: Array<{ name?: string; nodeType?: string; path?: string }>,
): string =>
  items
    .map((item) => `${item.name ?? '?'}(${item.nodeType ?? '?'})`)
    .join(', ') || '(none)';

export const summarizeDialFileManagerCache = (
  cache: Map<string, Array<{ name?: string; nodeType?: string; path?: string }>>,
): Record<string, string> =>
  Object.fromEntries(
    Array.from(cache.entries()).map(([key, items]) => [
      key || '(root)',
      summarizeCacheItems(items),
    ]),
  );
