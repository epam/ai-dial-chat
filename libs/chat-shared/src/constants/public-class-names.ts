/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the Markdown surface through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Issue #8707 asked for `dial-cm-code-block` for the fenced-code block. That
 * name is not available: `dial-cm-` belongs to `@epam/ai-dial-conversation-
 * messages`, while `MarkdownCodeBlock` is rendered from this package, and one
 * prefix shared by two libs is the collision the directory-name grammar exists
 * to prevent. The block is `dial-chat-shared-code-block`, and the
 * `conversation-messages` README points at it — a host that previously
 * descended from `dial-cm-assistant-content pre` can target the block itself.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CHAT_SHARED_CLASS = {
  /** The bordered container of a fenced code block. */
  codeBlock: 'dial-chat-shared-code-block',
  /** The code block's sticky header, holding the language label and actions. */
  codeBlockHeader: 'dial-chat-shared-code-block-header',
  /** The bordered container of a Markdown table. */
  table: 'dial-chat-shared-table',
  /** The scrolling box around a Markdown table, which owns its overflow. */
  tableScroll: 'dial-chat-shared-table-scroll',
  /** The scrolling box around a display-math block. */
  mathBlock: 'dial-chat-shared-math-block',
} as const;
