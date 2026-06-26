## Capability: canvas-markdown

### Overview

When a `.md` or `.markdown` file attachment is opened in the canvas, its content is rendered with styled GFM Markdown using `MarkdownRenderer` from `libs/chat-shared`, including headings, lists, code blocks (with syntax highlighting and copy button), tables, blockquotes, and inline code.

### Trigger condition

`useOpenAttachmentCanvas` routes to `resolveMarkdownCanvasContent` when the lowercased file extension is `md` or `markdown`. This check runs **before** the generic `isTextPreviewable` branch.

### Content resolution (app layer)

New function `resolveMarkdownCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts`:

1. Resolve the download URL via `resolveDialFileDownloadUrl(attachment.url)`. If `null`, return `null`.
2. `fetch` the resolved URL.
3. If the response is not OK, return `null` (canvas does not open; caller may fall back to download).
4. Return `{ type: AttachmentContentType.Markdown, text: await response.text() }`.

For locally-attached files (`'file' in attachment && attachment.file.size > 0`): read text directly from `attachment.file.text()`.

### Lib changes

1. Add `Markdown = 'markdown'` to `AttachmentContentType` enum (`libs/attachment-canvas/src/types/attachment-canvas.ts`).
2. Add `MarkdownCanvasContent` interface to `libs/attachment-canvas/src/models/attachment-canvas.ts`:
   ```ts
   export interface MarkdownCanvasContent {
     type: AttachmentContentType.Markdown;
     text: string;
   }
   ```
3. Add `MarkdownCanvasContent` to the `AttachmentCanvasContent` union.
4. In `AttachmentCanvas`, add a `Markdown` case that renders `<MarkdownRenderer content={content.text} />`.
5. Export `MarkdownCanvasContent` from `libs/attachment-canvas/src/index.ts`.
6. Add `@epam/ai-dial-chat-shared` to `libs/attachment-canvas/package.json` `peerDependencies`.

### Rendering

- `MarkdownRenderer` is rendered with neutral defaults: no `classNames` overrides, no custom `markdownComponents`, `isStreaming={false}`.
- The body wrapper (`h-full overflow-auto p-4`) provides scrolling; long documents scroll vertically.
- Download button is shown (same behavior as `PlainText`).
- Code blocks inside the markdown use the app's current theme (`codeBlockTheme` prop on `AttachmentCanvasContainer` → forwarded to `MarkdownRenderer`).
- A **Copy as Markdown** button (`IconMarkdown`) is shown to the **left** of the download button in the panel's `rightActions`. After a successful click the icon switches to `IconCheck` for 2 s, then reverts. The toggle state is managed inside `AttachmentCanvas` (same pattern as `MessageActions`). The copy action is delegated via an `onCopyMarkdown?: () => void` prop; `AttachmentCanvasContainer` provides it by calling `copyToClipboard(content.text)` when `content.type === Markdown`.

### i18n

No new i18n keys.

### RTL

`MarkdownRenderer` uses logical Tailwind classes (`ps/pe`, `ms/me`, `border-s/e`) internally. No additional RTL handling is needed in the canvas layer.

### Accessibility

No changes beyond the panel chrome documented in `canvas-panel`.

### Tests (unit)

- `AttachmentCanvas` renders `MarkdownRenderer` when `content.type === AttachmentContentType.Markdown`.
- `resolveMarkdownCanvasContent` returns `MarkdownCanvasContent` for a successful fetch.
- `resolveMarkdownCanvasContent` returns `null` for a non-OK response.
- `resolveMarkdownCanvasContent` reads local file text for an attachment with a `.file` property.
