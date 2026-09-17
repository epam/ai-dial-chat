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
  /**
   * The marker pill that opens a citation, additive to the
   * `dial-kit-base-button` that `@epam/ai-dial-ui-kit` draws. The pill caps its
   * own width and ellipsises a long source name, so a host widening it should
   * override `max-inline-size` here rather than unset the truncation.
   */
  citationMarker: 'dial-quotations-citation-marker',
} as const;
