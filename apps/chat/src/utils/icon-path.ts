import { isDialFileId } from '@epam/ai-dial-chat-hooks';
import { ApiEndpoints } from '../server-api/base';
import { resolveDialFileDownloadUrl } from './dial-file';

export const getIconPath = (iconName?: string): string => {
  return `${ApiEndpoints.THEME_ICON}?iconName=${encodeURIComponent(iconName || '')}`;
};

const ICON_MIME_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  gif: 'image/gif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/**
 * Returns the MIME type implied by an icon file name's extension (ignoring any
 * query string or fragment), or `undefined` when the extension is unknown.
 */
export const getIconMimeType = (iconName?: string): string | undefined => {
  const extension = iconName?.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  return extension ? ICON_MIME_TYPES[extension] : undefined;
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
