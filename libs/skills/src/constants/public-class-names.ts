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
  /** Controlled skill selector root carrying theme overrides. */
  selectorField: 'dial-skills-selector-field',
  /** The favorite-skills panel root, which carries the themed CSS variables. */
  favoritesPanel: 'dial-skills-favorites-panel',
  /**
   * The inline `/name` span a `ChatSkill` renders in both the composer and
   * conversation history. It is sized to the raw `/name` text so the composer
   * mirror stays aligned with the textarea, so a host changing its padding
   * should keep the net inline width and the vertical padding at zero.
   */
  chip: 'dial-skills-chip',
} as const;
