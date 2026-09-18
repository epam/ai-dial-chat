/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the navigation rail through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes — `role="navigation"` is an
 * accessibility contract, not a styling hook. They carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const NAVIGATION_PANEL_CLASS = {
  /** The `nav` rail itself. */
  rail: 'dial-navigation-panel-rail',
  /** Every item in the rail, whether or not it is the active one. */
  item: 'dial-navigation-panel-item',
} as const;
