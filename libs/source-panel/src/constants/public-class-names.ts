/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the sources panel through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SOURCE_PANEL_CLASS = {
  /**
   * The panel wrapper — the element `@epam/ai-dial-sidebar` gives the panel's
   * width and slide transition, which is the outer box a host sizes or
   * positions. It is **not** the `aside` inside it: that one carries
   * `dial-sb-aside`, so a host targeting the region itself descends from this
   * class.
   */
  panel: 'dial-source-panel-panel',
} as const;
