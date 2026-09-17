/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the sources panel through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. The panel is rendered by
 * `@epam/ai-dial-sidebar`, so its own `dial-sb-aside` is present too — this
 * class is what tells a sources panel apart from any other sidebar panel.
 * These classes carry no declarations of their own; they exist only as stable
 * selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SOURCE_PANEL_CLASS = {
  /** The panel itself, additive to the sidebar's own `dial-sb-aside`. */
  panel: 'dial-source-panel-panel',
} as const;
