## Why

The `AttachmentCanvas` currently renders all text-based files (`.xml`, `.csv`, `.yaml`, `.ts`, `.py`, `.html`, etc.) as unstyled `<pre>` blocks, making structured code and markup hard to read. HTML files additionally deserve a rendered preview — the user should see the page, not its source — and external HTML URLs linked from assistant responses should open in an inline iframe when the host page allows embedding.

## What Changes

- **New `AttachmentContentType.Code` variant** — a syntax-highlighted viewer for all text-previewable extensions that are not already routed to a dedicated renderer (Markdown, JSON, PDF). Keeps the existing "Copy text" action. `PlainText` is retained as-is for backward compatibility.
- **New `AttachmentContentType.Html` variant** — renders HTML content in a sandboxed `<iframe>` via `srcdoc` (for file attachments) or `src` (for external URL links). Detects CSP/X-Frame-Options blocks and shows a friendly fallback with an "Open in new tab" button.
- **`html`/`htm` split out of `TEXT_EXTENSIONS`** — a new `HTML_EXTENSIONS` constant gates the HTML route; the code-highlighting route covers the remaining extensions.
- **`AttachmentCanvasLabels` extended** — two new optional string props: `htmlFrameBlockedLabel` and `htmlOpenInNewTabLabel`.
- **Routing update in `apps/chat/src/utils/attachment-canvas.ts`** — `html`/`htm` files (attachment or URL) resolve to `HtmlCanvasContent`; all other text-previewable extensions resolve to `CodeCanvasContent` instead of `PlainTextCanvasContent`.
- **`canvas` spec updated** — content-type routing table, renderer table, and i18n table extended.

## Capabilities

### New Capabilities

- `attachment-canvas-code-viewer`: Syntax-highlighted viewer for text/code attachments inside `AttachmentCanvas`; adds `Code` content type.
- `attachment-canvas-html-viewer`: Sandboxed iframe HTML renderer for `.html`/`.htm` files and external HTML URLs; adds `Html` content type.

### Modified Capabilities

- `canvas`: Content-type routing table and renderer table extended with `Code` and `Html` rows; i18n table updated with two new `Html` labels.

## Impact

- **`libs/attachment-canvas`** — new enum members, new model interfaces, two new sub-components (`CodeContent`, `HtmlContent`), updated `AttachmentCanvas` switch, updated `AttachmentCanvasLabels`, split constants file.
- **`apps/chat/src/utils/attachment-canvas.ts`** — routing logic updated; two new resolver functions (`resolveCodeCanvasContent`, `resolveHtmlCanvasContent`).
- **`apps/chat/src/constants/translation-keys.ts`** — two new `AttachmentCanvasI18nKeys` members.
- **`apps/chat/src/i18n/locales/en.json`** — two new English strings.
- **`apps/chat/src/components/AttachmentCanvasContainer`** — wires up new label props.
- **New dependency** — `react-syntax-highlighter` (and `@types/react-syntax-highlighter`) added to `libs/attachment-canvas`; if already present in the workspace, no new install is required.
- **No breaking changes** — `PlainText` enum value and its model are untouched; existing callers are unaffected.
