import type { ThemeConfigResponseDto } from '@epam/ai-dial-chat-api-client';
import { themesApi } from './api-client';
import { ApiEndpoints } from './base';

/**
 * Fetches a theme configuration from an application-supplied themes host.
 *
 * The URL is proxied by `chat-api`, which rejects anything outside the
 * operator's origin allowlist — the browser never contacts the themes host
 * directly.
 */
export const getRemoteTheme = (
  themeUrl: string,
): Promise<ThemeConfigResponseDto> => themesApi.getRemoteTheme({ themeUrl });

/**
 * Builds the `<img src>` for one image on an application-supplied themes host.
 *
 * Built by hand rather than through the generated client because the response
 * is raw SVG or binary, not JSON — the same reason `resolveCatalogIconUrl`
 * builds the built-in `/api/themes/icon` URL itself.
 */
export const buildRemoteThemeIconUrl = (
  themeUrl: string,
  iconName: string,
): string => {
  const params = new URLSearchParams({ themeUrl, iconName });
  return `${ApiEndpoints.THEMES_REMOTE_ICON}?${params.toString()}`;
};
