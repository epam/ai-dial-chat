/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the publish panel through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const PUBLISH_PANEL_CLASS = {
  /** The panel body, which carries the themed CSS variables. */
  panel: 'dial-publish-panel-panel',
} as const;
