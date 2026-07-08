import { ApiEndpoints } from '../server-api/base';
import { isDialFileId, resolveDialFileDownloadUrl } from './dial-file';

export {
  isDialFileId,
  resolveDialFileDownloadUrl,
  resolveRelativeDialFilePath,
} from './dial-file';

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
