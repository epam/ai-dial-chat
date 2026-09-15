/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the panel controls through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. In particular they replace
 * `[role='complementary'] > div:nth-child(2) > div:first-child > button` and
 * `[role='search'] .dial-kit-input`, which break whenever the panel's
 * structure changes. These classes carry no declarations of their own; they
 * exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CONVERSATION_PANEL_CLASS = {
  /** The new-chat button. */
  newChatButton: 'dial-cp-new-chat-button',
  /** The `role="search"` wrapper around the conversation search field. */
  search: 'dial-cp-search',
} as const;
