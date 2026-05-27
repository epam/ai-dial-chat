/**
 * Returns `url` when it is safe to use as an `<img src>` (absolute URL or
 * root-relative path).  Returns `undefined` for any other value so callers
 * can fall back to a default icon.
 */
export const resolveIconUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  const lower = url.toLowerCase();
  return lower.startsWith('/') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('data:')
    ? url
    : undefined;
};
