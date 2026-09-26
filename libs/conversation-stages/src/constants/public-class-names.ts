/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the stages list through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CONVERSATION_STAGES_CLASS = {
  /** The stages panel root, which carries the themed CSS variables. */
  panel: 'dial-conversation-stages-panel',
  /** The root of a `CollapsedGroup`, wrapping its summary line and the panel. */
  group: 'dial-conversation-stages-group',
  /** The summary line of a `CollapsedGroup`, which expands and collapses it. */
  groupToggle: 'dial-conversation-stages-group-toggle',
} as const;
