/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the skill editor through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. These classes carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SKILL_EDITOR_CLASS = {
  /** The editor's root surface, which is also the file drop zone. */
  root: 'dial-skill-editor-root',
} as const;
