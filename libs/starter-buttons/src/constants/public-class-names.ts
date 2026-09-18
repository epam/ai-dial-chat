/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the starter buttons through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes — the list's `aria-label` comes from
 * `labels.list` and is localisable, so it must never be used as a selector.
 * These classes carry no declarations of their own; they exist only as stable
 * selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const STARTER_BUTTONS_CLASS = {
  /** The component's outer wrapper. */
  root: 'dial-starter-buttons-root',
  /** The `role="list"` box holding the buttons, in both layouts. */
  list: 'dial-starter-buttons-list',
} as const;
