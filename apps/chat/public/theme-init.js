/*
 * Paints the last theme the app applied before the bundle loads, so a reload
 * shows the user's palette straight away instead of the built-in light one
 * until `/api/themes` answers.
 *
 * This is a classic script kept in `public/`, not part of the bundle, because
 * it has to run before the module bundle is parsed. A production build inlines
 * it into the `index.html` head (`tools/vite/inline-public-script.mjs`), and
 * chat-api allows it by its SHA-256 hash, so first paint does not wait on a
 * request for it; the dev server loads it from `public/`. The build drops this
 * leading comment and keeps everything below byte for byte, so any edit
 * changes the hash, which chat-api recomputes from the built `index.html`.
 * It cannot import anything, so the names
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
