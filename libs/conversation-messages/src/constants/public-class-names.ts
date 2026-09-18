/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style message bubbles through these instead of hashed CSS-module
 * locals or ARIA attributes. In particular they replace
 * `[class*='userBubble']` and `[aria-live='polite']`, the first of which
 * changes on every stylesheet edit and the second of which is an accessibility
 * contract rather than a styling one. These classes carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CONVERSATION_MESSAGES_CLASS = {
  /** The user message's bubble element. */
  userBubble: 'dial-cm-user-bubble',
  /** The assistant message's streamed content region. */
  assistantContent: 'dial-cm-assistant-content',
} as const;
