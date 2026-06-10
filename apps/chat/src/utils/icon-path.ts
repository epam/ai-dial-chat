import { ApiEndpoints } from '../server-api/base';

export const getIconPath = (iconName?: string): string => {
  return `${ApiEndpoints.THEME_ICON}?iconName=${encodeURIComponent(iconName || '')}`;
};

const isAbsoluteUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('data:')
  );
};

const isDialFileId = (url: string): boolean => url.startsWith('files/');

/**
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF download URL.
 * Returns `undefined` if the input does not start with `files/` or has no path segment.
 * The path segment is decoded with `decodeURIComponent` before being set as the query parameter.
 */
export const resolveDialFileDownloadUrl = (
  fileId: string,
): string | undefined => {
  if (!fileId.startsWith('files/')) return undefined;
  const withoutPrefix = fileId.slice('files/'.length);
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx < 0) return undefined;
  const bucket = withoutPrefix.slice(0, slashIdx);
  const rawPath = withoutPrefix.slice(slashIdx + 1);
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }
  const params = new URLSearchParams({ bucket, path });
  return `/api/v1/files/download?${params.toString()}`;
};

/**
 * Resolves a raw DIAL `icon_url` value to a URL usable in an <img> src.
 *
 * DIAL returns three formats:
 *  - Absolute URLs → returned as-is
 *  - DIAL file IDs (`files/{bucket}/{path}`) → proxied via BFF download endpoint
 *  - Theme-relative names → mapped to /api/themes/icon?iconName={encoded}
 */
export const resolveCatalogIconUrl = (
  iconUrl: string | undefined,
): string | undefined => {
  if (!iconUrl) return undefined;
  if (isAbsoluteUrl(iconUrl)) return iconUrl;
  if (isDialFileId(iconUrl)) return resolveDialFileDownloadUrl(iconUrl);
  return getIconPath(iconUrl);
};
