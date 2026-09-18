/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the skill surfaces through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SKILLS_CLASS = {
  /** The favorite-skills panel root, which carries the themed CSS variables. */
  favoritesPanel: 'dial-skills-favorites-panel',
  /**
   * The `/name` chip a `ChatSkill` renders inside the composer, additive to
   * the `dial-kit-base-button` that `@epam/ai-dial-ui-kit` draws. The chip's
   * height is its label line, so a host changing its padding should keep the
   * vertical padding at zero or the chip stops aligning with the input's first
   * text line.
   */
  chip: 'dial-skills-chip',
} as const;
