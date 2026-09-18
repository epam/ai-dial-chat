/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the panel chrome through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. In particular they replace
 * `[role='complementary']` and its `> div:nth-child(n)` descendants, which
 * change whenever the panel's structure changes. These classes carry no
 * declarations of their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SIDEBAR_CLASS = {
  /**
   * The panel's `<aside role="complementary">` element — the region itself,
   * not the wrapper around it. The wrapper is where `styles.className` lands,
   * which is how the libs built on this panel mark themselves:
   * `@epam/ai-dial-attachment-canvas` puts `dial-attachment-canvas-panel`
   * there and `@epam/ai-dial-source-panel` puts `dial-source-panel-panel`. A
   * host targeting one of those panels therefore descends from its class to
   * this one (`.dial-attachment-canvas-panel .dial-sb-aside`), and sizes or
   * positions the wrapper rather than the region.
   */
  aside: 'dial-sb-aside',
  /** The 48 px header bar rendered by `Header`. */
  header: 'dial-sb-header',
} as const;
