/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the citation surfaces through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const QUOTATIONS_CLASS = {
  /** The citation card's `role="dialog"` root, which carries the themed CSS variables. */
  citationCard: 'dial-quotations-citation-card',
  /** The floating panel a `CitationDropdown` reveals, which holds the card. */
  citationDropdown: 'dial-quotations-citation-dropdown',
} as const;
