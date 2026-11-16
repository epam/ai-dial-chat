import { isDialFileId, isDialProjectFileId } from '@epam/ai-dial-chat-hooks';
import { ApiEndpoints } from '../server-api/base';
import {
  resolveDialFileDownloadUrl,
  resolveProjectFileDownloadUrl,
} from './dial-file';

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
  const fileName = iconName?.split(/[?#]/)[0].split('/').pop();
  if (!fileName?.includes('.')) return undefined;
  const extension = fileName.split('.').pop()?.toLowerCase();
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

/* The icon names `GET /api/themes/icon` accepts. */
const THEME_ICON_NAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

/*
 * Returns the theme icon name when `iconUrl` points straight at a file under
 * the themes service, so it can load through the same proxy URL as the
 * theme-relative form of that icon.
 */
const getThemesHostIconName = (
  iconUrl: string,
  themesBaseUrl: string | null | undefined,
): string | undefined => {
  if (!themesBaseUrl) return undefined;
  const prefix = `${themesBaseUrl}/`;
  if (!iconUrl.startsWith(prefix)) return undefined;
  const iconName = iconUrl.slice(prefix.length);
  return THEME_ICON_NAME_PATTERN.test(iconName) ? iconName : undefined;
};

/**
 * Resolves a raw DIAL `icon_url` value to a URL usable in an <img> src.
 *
 * DIAL returns three formats:
 *  - Absolute URLs → returned as-is, except a file directly under
 *    `themesBaseUrl`, which maps to the same proxy URL as its theme-relative
 *    name so the browser fetches that icon once
 *  - DIAL file IDs (`files/{bucket}/{path}`) → proxied via BFF download endpoint
 *  - DIAL project file IDs (`projects/{bucket}/{path}/files/{filePath}`, e.g.
 *    an image an agent generated in a project chat) → the project file
 *    endpoint, or `undefined` when no route serves the folder
 *  - Theme-relative names → mapped to /api/themes/icon?iconName={encoded}
 */
export const resolveCatalogIconUrl = (
  iconUrl: string | undefined,
  themesBaseUrl?: string | null,
): string | undefined => {
  if (!iconUrl) return undefined;
  if (isAbsoluteUrl(iconUrl)) {
    const themesIconName = getThemesHostIconName(iconUrl, themesBaseUrl);
    return themesIconName != null ? getIconPath(themesIconName) : iconUrl;
  }
  if (isDialFileId(iconUrl)) return resolveDialFileDownloadUrl(iconUrl);
  if (isDialProjectFileId(iconUrl)) {
    return resolveProjectFileDownloadUrl(iconUrl);
  }
  return getIconPath(iconUrl);
};
