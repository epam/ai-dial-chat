/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the prompt surfaces through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const PROMPTS_CLASS = {
  /** The favorite-prompts panel root, which carries the themed CSS variables. */
  favoritesPanel: 'dial-prompts-favorites-panel',
} as const;
