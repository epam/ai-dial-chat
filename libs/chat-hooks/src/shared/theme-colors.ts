/** Colour scheme the operating system reports through `prefers-color-scheme`. */
export enum ColorScheme {
  /** The OS asks for a dark scheme. */
  Dark = 'dark',
  /** The OS asks for a light scheme, or states no preference. */
  Light = 'light',
}

/** Returns the colour scheme the OS currently prefers. */
export const getOsPreferredTheme = (): ColorScheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? ColorScheme.Dark
    : ColorScheme.Light;

/*
 * Custom properties written by the last `applyThemeColors` call, per element.
 * Themes are free to declare different key sets, so writing the next theme
 * without removing the previous one's keys leaves the old colours in place for
 * every key the new theme happens to omit. A WeakMap keeps the bookkeeping off
 * the element and lets a detached element be collected.
 */
const appliedProperties = new WeakMap<HTMLElement, string[]>();

/**
 * Writes `colors` to `element` as `--<key>` custom properties after removing
 * the ones the previous call wrote to that element. Without `colors` it only
 * removes them; properties it never wrote are left alone.
 */
export const applyThemeColors = (
  element: HTMLElement,
  colors?: Readonly<Record<string, string>>,
): void => {
  const previous = appliedProperties.get(element);
  if (previous) {
    previous.forEach((property) => element.style.removeProperty(property));
    appliedProperties.delete(element);
  }

  if (!colors) return;

  const written = Object.entries(colors).map(([key, value]) => {
    const property = `--${key}`;
    element.style.setProperty(property, value);
    return property;
  });

  if (written.length > 0) {
    appliedProperties.set(element, written);
  }
};
