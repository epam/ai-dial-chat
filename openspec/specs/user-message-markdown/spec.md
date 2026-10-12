# user-message-markdown Specification

## Purpose

User message bubbles render their content as sanitized Markdown, the same way assistant messages do, with raw HTML shown as literal text, while keeping collapse, copy, edit, selection-reply, RTL and accessibility behaviour.

## Requirements

### Requirement: User message text renders as Markdown

`UserMessageBubble` (`libs/conversation-messages/src/components/MessageBubble/UserMessageBubble.tsx`) SHALL render its `text` through `MDMessageViewer` from `@epam/ai-dial-chat-shared`. This is the same `MarkdownRenderer` pipeline (GFM, `remark-breaks`, `$$` math, sanitization) that `AssistantMessageBubble` uses, so a user message's fenced code blocks, inline code, headings, emphasis, ordered/unordered and task lists, blockquotes, links, horizontal rules, GFM tables and block math render the same way they render in an assistant message. Rendering SHALL be unconditional. It SHALL NOT be gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, by an overlay feature, or by the conversation's `ResponseFormat`, which keeps applying to assistant messages only. The message content, the request payload and `custom_content` SHALL NOT change. Rendering is purely presentational, and no React context or new state owner is introduced: the bubble derives everything from its props.

#### Scenario: Code snippet from issue #173

- **WHEN** a user sends a message whose content is a ```` ```ts ```` fence containing `const add = (x: number) => (y: number): number => x + y;`
- **THEN** the user bubble renders a `MarkdownCodeBlock` with the `ts` language label, syntax highlighting (subject to `bounded-syntax-highlighting`) and its Copy code / Download code buttons
- **AND** the backtick fence characters are not shown as text

#### Scenario: Inline formatting

- **WHEN** a user message contains `Use **bold**, *italic* and \`inline\` code`
- **THEN** the bubble renders a `<strong>`, an `<em>` and an inline `<code>` element, with no literal `**`, `*` or backtick characters

#### Scenario: Lists and headings

- **WHEN** a user message contains a `# Title` line followed by `- a` and `- b` lines
- **THEN** the bubble renders a heading element and an unordered list with two items

#### Scenario: Table in a user message

- **WHEN** a user message contains a GFM pipe table
- **THEN** the bubble renders it with `MarkdownTable`, horizontally scrollable within the bubble's maximum width

#### Scenario: Plain prose is visually unchanged

- **WHEN** a user message contains only prose lines with no Markdown syntax
- **THEN** each line renders on its own visual line in the same text color and typography class as before

#### Scenario: Response format does not affect user bubbles

- **WHEN** the conversation's response format is `ResponseFormat.PlainText`
- **THEN** user bubbles still render Markdown, and only assistant bubbles render verbatim

### Requirement: Raw HTML in user messages renders as literal text

The user bubble SHALL render raw HTML found in the message source as literal text, not as HTML elements. It does this by passing `isRawHtmlEnabled={false}` through `MDMessageViewer` to `MarkdownRenderer` (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`), which then omits its `rehype-raw` step. `isRawHtmlEnabled` SHALL default to `true`, so assistant messages and every other `MarkdownRenderer` consumer keep re-parsing raw HTML exactly as today. Sanitization (`rehype-sanitize`) and the URL protocol allowlist (`defaultUrlTransform`) SHALL apply to user messages exactly as they apply to assistant messages.

#### Scenario: Tag typed outside backticks

- **WHEN** a user message contains `What does <div> do?`
- **THEN** the bubble shows the text `What does <div> do?` with `<div>` visible

#### Scenario: Script is never executed

- **WHEN** a user message contains `<script>alert(1)</script>` or `<img src=x onerror=alert(1)>`
- **THEN** no element is created from it and no script runs, and the source text is shown literally

#### Scenario: Unsafe link protocol

- **WHEN** a user message contains `[click](javascript:alert(1))`
- **THEN** the rendered link carries no `javascript:` href

#### Scenario: Assistant HTML unaffected

- **WHEN** an assistant message contains `line<br>break`
- **THEN** it still renders a line-break element, as before this change

### Requirement: User bubble forwards Markdown presentation props

`UserMessageBubble` SHALL forward these props to `MDMessageViewer`: `codeBlockTheme`, `markdownClassNames`, `markdownUrlTransform` and `tableOnOpenInCanvas`, plus the labels `codeBlockCopyLabel`, `codeBlockCopiedLabel`, `codeBlockDownloadLabel`, `tableCopyLabel`, `tableCopiedLabel`, `tableDownloadCsvLabel`, `tableOpenInCanvasLabel`, `tableDownloadFilename`, `tableScrollRegionAriaLabel` and `mathScrollRegionAriaLabel`. The lib's English defaults apply when a label is absent. `MessageBubble` SHALL pass these to the user bubble, and SHALL keep withholding `markdownComponents`, because citation overrides are assistant-only. The host (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`) SHALL supply the same translated values it already supplies to assistant bubbles. No new i18n keys are introduced. Host knowledge (DIAL file-id to download-URL mapping, the code theme resolved from the app theme, the canvas callback) SHALL reach the lib only through these props.

#### Scenario: Localized code block labels

- **WHEN** the app renders a user message with a code block in a non-English locale
- **THEN** the code block's copy and download buttons use the same translated labels as an assistant code block

#### Scenario: Compact typography

- **WHEN** the host passes `COMPACT_MARKDOWN_CLASS_NAMES` as `markdownClassNames`
- **THEN** user Markdown elements use that scale too

#### Scenario: Code theme follows the app theme

- **WHEN** the app is in dark theme
- **THEN** user code blocks use the same `codeBlockTheme` value as assistant code blocks

### Requirement: Long user messages keep collapsing

The "Show more" / "Show less" behavior SHALL continue to work on the rendered Markdown. `useCollapsedText` SHALL measure the rendered Markdown container (code blocks, tables and headings included) instead of the former `<p>`. A message SHALL still collapse to `collapsedLineCount` (default `10`) line-heights of the bubble's text style, with the existing fade, `aria-expanded` and `aria-controls` wiring.

#### Scenario: Long code snippet collapses

- **WHEN** a user message renders a code block taller than ten text lines
- **THEN** the bubble collapses with the fade, and a "Show more" button with `aria-expanded="false"` is shown

#### Scenario: Expand reveals the full rendered content

- **WHEN** the user activates "Show more"
- **THEN** the full rendered Markdown is visible and the button reads "Show less" with `aria-expanded="true"`

### Requirement: Copy, edit and selection keep working on source text

Rendering Markdown SHALL NOT change what other message features act on:

- Copy message SHALL still write the raw `Message.content` (see `user-message-copy`).
- Edit SHALL still open `EditMessageInput` pre-filled with the raw text, Markdown characters included (see `edit-message`).
- Selection Reply SHALL capture visible rendered text (see `message-selection-reply`).
- Copying a native selection SHALL keep using `copySelectionWithoutStyles`.

#### Scenario: Copy returns Markdown source

- **WHEN** the user clicks "Copy message" on a message whose content is `**bold**`
- **THEN** the clipboard contains exactly `**bold**`

#### Scenario: Edit shows Markdown source

- **WHEN** the user clicks Edit on a message rendered with a code block
- **THEN** the edit textarea contains the original fence characters and code text

### Requirement: Rendered user Markdown is accessible and RTL-safe

The user bubble SHALL keep its `role="group"` and translated `aria-label`. Because user messages are not streamed, it SHALL NOT add an `aria-live` region around the user text. Interactive Markdown elements (code-block buttons, table scroll regions, links) SHALL be keyboard reachable in reading order and keep their accessible names. The user text container SHALL keep `text-start` and logical-property classes, so headings, lists and blockquotes align to the inline start in RTL. Code blocks SHALL stay LTR inside RTL pages, per `markdown-code-blocks`. No new directional icons are introduced.

#### Scenario: RTL list

- **WHEN** `dir="rtl"` is set and a user message contains a bulleted list
- **THEN** the bullets and text align to the right (inline start) edge of the bubble

#### Scenario: Keyboard reaches code copy

- **WHEN** a keyboard user tabs through a user message containing a code block
- **THEN** focus reaches the block's Copy code button, which announces its label

### Requirement: Rendering is memoized

User-bubble rendering SHALL NOT re-parse unchanged content on unrelated parent re-renders. `MarkdownRenderer` stays `React.memo`. The user bubble SHALL pass stable references for its rehype plugin array, components map and table-action labels object: `useMemo` keyed on `textSegments` and labels, and module-level constants where the value is static.

#### Scenario: Unrelated re-render

- **WHEN** the conversation re-renders because a later assistant message streams a token
- **THEN** earlier user bubbles whose props are unchanged do not re-run the Markdown parse
