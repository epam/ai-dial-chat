import { toRelativePath } from './dial-resource-path.util';

const stripTrailingSlash = (path: string): string =>
  path.endsWith('/') ? path.slice(0, -1) : path;

/*
 * DIAL Core echoes `url` percent-encoded (`New%20folder/a.pdf`) while the paths
 * this app carries around are plain, so both sides are decoded before being
 * compared. A url that is not valid percent-encoding is compared raw rather
 * than throwing.
 */
const normalizeResourcePath = (value: string): string => {
  try {
    return stripTrailingSlash(decodeURIComponent(value));
  } catch {
    return stripTrailingSlash(value);
  }
};

/**
 * True only when DIAL returned metadata for this exact resource. A metadata
 * probe for a missing path can resolve to a *different* resource (a parent
 * folder listing, most often), so the returned `url` must be checked against
 * the path that was asked for.
 */
export const fileMetadataMatchesPath = (
  data: unknown,
  bucket: string,
  path: string,
): boolean => {
  if (data == null || typeof data !== 'object') return false;

  const { url } = data as { url?: string };
  if (url == null) return false;

  return (
    normalizeResourcePath(toRelativePath(url, bucket)) ===
    normalizeResourcePath(path)
  );
};
