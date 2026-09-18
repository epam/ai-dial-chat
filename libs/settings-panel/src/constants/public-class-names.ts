/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the settings navigation through these instead of hashed
 * CSS-module locals, DOM order, or ARIA attributes — `role="tablist"` and
 * `role="tab"` are accessibility contracts, not styling hooks. They carry no
 * declarations of their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SETTINGS_PANEL_CLASS = {
  /** The panel root, which carries the themed CSS variables. */
  panel: 'dial-settings-panel-panel',
  /** The vertical tab list holding the section rows. */
  tabList: 'dial-settings-panel-tab-list',
  /** Every section row, selected or not. */
  tab: 'dial-settings-panel-tab',
} as const;
