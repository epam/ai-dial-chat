/*
 * Paints the last theme the app applied before the bundle loads, so a reload
 * shows the user's palette straight away instead of the built-in light one
 * until `/api/themes` answers.
 *
 * This is a classic script served from `public/`, not part of the bundle: the
 * app-shell CSP allows `'self'` scripts but no inline ones, and it has to run
 * before the module bundle is parsed. A production build serves it from a
 * content-hashed copy under `assets/` (`tools/vite/hashed-public-script.mjs`)
 * so it is cached as immutable. It cannot import anything, so the names
 * it reads are spelled out here — `theme` (`StorageKey.Theme`), `themeColors`
 * (`StorageKey.ThemeColors`) and `data-theme-preload`
 * (`THEME_PRELOAD_ATTRIBUTE` in `src/utils/theme-preload.ts`).
 * `ThemeContext` removes every property listed in that attribute before it
 * applies the configuration it fetched.
 */
(() => {
  try {
    const storage = window.localStorage;
    const stored = storage.getItem('theme') || 'light';
    let themeId = stored;
    if (stored === 'system') {
      const prefersDark =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeId = prefersDark ? 'dark' : 'light';
    }

    const cache = JSON.parse(storage.getItem('themeColors') || 'null');
    const colors = cache && cache[themeId];
    if (!colors || typeof colors !== 'object') return;

    const root = document.documentElement;
    const written = [];
    Object.keys(colors).forEach((key) => {
      const value = colors[key];
      if (typeof value !== 'string') return;
      const property = `--${key}`;
      root.style.setProperty(property, value);
      written.push(property);
    });
    if (written.length > 0) {
      root.setAttribute('data-theme-preload', written.join(' '));
    }
  } catch {
    /* Storage is blocked or the cache is malformed: keep the default palette. */
  }
})();
