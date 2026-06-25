## Why

Attachments in the AI DIAL Chat conversation (user messages, assistant responses, stages, the sources panel) had no in-app preview — clicking an attachment triggered a file download. For images, text, Markdown documents, and structured JSON files, an inline preview is far more useful. A resizable right-side panel ("canvas") keeps the conversation visible while the file is inspected.

## What Changes

A new `libs/attachment-canvas` library provides the host-agnostic preview panel. The app layer wires content resolution, URL fetching, and open/close triggers. The foundation (image + plain-text + unsupported fallback) was introduced together with this change; the next planned formats are:

- **Markdown** — `.md` / `.markdown` files rendered with `MarkdownRenderer` (from `@epam/ai-dial-chat-shared`) instead of a raw `<pre>` block.
- **JSON** — `.json` files rendered with an interactive `react-json-view-lite` collapsible tree.

## Capabilities

### New Capabilities

- `canvas-panel`: The `AttachmentCanvas` side-panel — open/close behavior, header (file name + download + close), auto-close on conversation switch, resizability, content routing.
- `canvas-markdown`: Styled Markdown rendering inside the canvas.
- `canvas-json`: Interactive JSON tree rendering inside the canvas.

### Future Capabilities (out of scope for this iteration)

- PDF, audio, and video preview.
- Inline code snippets and quotations/citations as standalone canvas entries (citations are currently rendered as inline `CitationDropdown` widgets inside assistant message text; previewing a cited attachment opens the canvas through the existing `onPreview` callback on `CitationDropdown`).

## Non-Goals

- Server-side content rendering or caching.
- Feature-flag gating — the canvas is always available to authenticated users.
- Full-page modal or inline message-bubble expansion.
- PDF, video, or audio preview.

## Acceptance Criteria

1. Clicking an image attachment opens the canvas with the image centered and a download button in the header.
2. Clicking a `.md` / `.markdown` file opens the canvas with styled GFM Markdown (headings, lists, code blocks, tables, blockquotes).
3. Clicking a `.json` file opens the canvas with an interactive, collapsible JSON tree.
4. Clicking a `.txt`, `.py`, `.ts`, or other text-previewable file opens the canvas with raw plain text.
5. Clicking an unsupported file type (e.g., `.pdf`) opens the canvas with a "Preview not supported" message and a download button.
6. Navigating to a different conversation (or any other route) closes the canvas automatically.
7. The download button is visible and functional for all content types except `Unsupported`.
8. The canvas opens from: conversation message attachments (user and assistant), stage attachments, the input tray, the edit-message tray, and the sources/files panel.

## Alternatives Considered

- **Full-page modal** — rejected; a side panel keeps the conversation visible for cross-reference.
- **Inline message-bubble expansion** — rejected; breaks layout for large files and is not discoverable.
- **Render-function prop for format extensibility** — rejected; a typed discriminated union gives compile-time exhaustiveness and avoids an unstable plugin API.

## Rollback / Backward Compatibility

No breaking API changes. The canvas is net-new UI; the feature can be reverted by removing the `AttachmentCanvasContainer` mount from `app.tsx`. The `libs/attachment-canvas` public API is additive.

## i18n Impact

`AttachmentCanvasI18nKeys` in `apps/chat/src/constants/translation-keys.ts` already contains `AriaLabel`, `CloseLabel`, `DownloadLabel`, `UnsupportedLabel`. No new app-level i18n keys are required for Markdown or JSON support — lib-level strings use English string props with defaults.
