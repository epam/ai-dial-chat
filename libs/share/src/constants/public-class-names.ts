/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the share popover through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes — the popover's `aria-label` is its
 * localisable title, so it was never a selector. They carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SHARE_CLASS = {
  /** The popover's `role="dialog"` root, which carries the themed CSS variables. */
  popover: 'dial-share-popover',
} as const;
