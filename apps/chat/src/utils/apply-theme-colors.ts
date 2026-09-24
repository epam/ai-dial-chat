import { Theme } from '@epam/ai-dial-chat-shared';
import { ThemeId } from '../types/theme-id';

export const getOsPreferredTheme = (): string =>
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? ThemeId.Dark
    : ThemeId.Light;

/*
 * Custom properties written by the last `applyThemeColors` call, per element.
 * Themes are free to declare different key sets, so writing the next theme
 * without removing the previous one's keys leaves the old colours in place for
 * every key the new theme happens to omit. A WeakMap keeps the bookkeeping off
 * the element and lets a detached element be collected.
 */
const appliedProperties = new WeakMap<HTMLElement, string[]>();

/**
 * Applies a theme's colors to `element` as CSS custom properties, first
 * removing the properties the previous call wrote to that same element.
 *
 * Passing no theme clears the previously applied properties and writes
 * nothing, returning the element to the values its stylesheets provide.
 * Properties this function never wrote are left alone.
 */
export const applyThemeColors = (element: HTMLElement, theme?: Theme) => {
  const previous = appliedProperties.get(element);
  if (previous) {
    previous.forEach((property) => element.style.removeProperty(property));
    appliedProperties.delete(element);
  }

  if (!theme) return;

  const written = Object.entries(theme.colors).map(([key, value]) => {
    const property = `--${key}`;
    element.style.setProperty(property, value);
    return property;
  });

  if (written.length > 0) {
    appliedProperties.set(element, written);
  }
};
