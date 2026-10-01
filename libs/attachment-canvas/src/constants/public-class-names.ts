/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the canvas through these instead of hashed CSS-module locals,
 * DOM order, or ARIA attributes. They carry no declarations of their own; they
 * exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const ATTACHMENT_CANVAS_CLASS = {
  panel: 'dial-attachment-canvas-panel',
} as const;
