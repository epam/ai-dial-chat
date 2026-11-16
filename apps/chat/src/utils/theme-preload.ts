import { Theme } from '@epam/ai-dial-chat-shared';
import { StorageKey } from '../types/storage-key';
import { ThemeId } from '../types/theme-id';
import { setToLocalStorage } from './local-storage';

/**
 * Attribute `public/theme-init.js` sets on `<html>`: a space-separated list
 * of the custom properties it wrote from the cached theme colours.
 */
export const THEME_PRELOAD_ATTRIBUTE = 'data-theme-preload';

/**
 * Stores every configured theme's colours by id, so `public/theme-init.js`
 * can paint the stored theme on the next load before `/api/themes` answers.
 * All themes are kept, not just the selected one: `system` needs both `light`
 * and `dark`, and resolves only when the script runs.
 */
export const cacheThemeColors = (themes: readonly Theme[] = []): void => {
  const colorsById = Object.fromEntries(
    themes
      .filter((theme) => theme.colors != null)
      .map((theme) => [theme.id, theme.colors]),
  );
  try {
    setToLocalStorage(StorageKey.ThemeColors, JSON.stringify(colorsById));
  } catch {
    /* Quota or blocked storage only costs the next load its early paint. */
  }
};

/**
 * Removes the properties `public/theme-init.js` wrote. `applyThemeColors`
 * removes only the properties it wrote itself, so without this a key the
 * cached theme had and the fetched one lacks would stay on the page.
 */
export const clearPreloadedThemeColors = (root: HTMLElement): void => {
  const properties = root.getAttribute(THEME_PRELOAD_ATTRIBUTE);
  if (properties == null) return;
  properties
    .split(' ')
    .filter(Boolean)
    .forEach((property) => root.style.removeProperty(property));
  root.removeAttribute(THEME_PRELOAD_ATTRIBUTE);
};

/**
 * The theme to report before the configuration loads: the stored id, with
 * `system` resolved against the OS. The configuration effect corrects it once
 * it knows which themes exist.
 */
export const resolveInitialThemeId = (
  storedThemeId: string | null | undefined,
  getOsTheme: () => string,
): string => {
  if (!storedThemeId) return ThemeId.Light;
  if (storedThemeId === ThemeId.System) return getOsTheme();
  return storedThemeId;
};
