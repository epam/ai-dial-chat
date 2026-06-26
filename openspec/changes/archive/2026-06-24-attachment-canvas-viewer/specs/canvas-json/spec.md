## Capability: canvas-json

### Overview

When a `.json` file attachment is opened in the canvas, its content is rendered as an interactive, collapsible JSON tree using `react-json-view-lite`. Other line-delimited JSON formats (`.jsonl`, `.ndjson`) are not supported by the tree viewer and fall through to the plain-text renderer.

### Trigger condition

`useOpenAttachmentCanvas` routes to `resolveJsonCanvasContent` when the lowercased file extension is exactly `json`. This check runs **before** the generic `isTextPreviewable` branch.

`.jsonl` and `.ndjson` are not routed to `resolveJsonCanvasContent`; they continue to use `resolveTextCanvasContent` and render as plain text.

### Content resolution (app layer)

New function `resolveJsonCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts`:

1. Resolve the download URL via `resolveDialFileDownloadUrl(attachment.url)`. If `null`, return `null`.
2. `fetch` the resolved URL.
3. If the response is not OK, return `null`.
4. `const rawText = await response.text()`.
5. Attempt `JSON.parse(rawText)`.
   - On success: return `{ type: AttachmentContentType.Json, value: parsed }`.
   - On `SyntaxError`: return `{ type: AttachmentContentType.PlainText, text: rawText }` — graceful degradation; the user sees the raw file content.

For locally-attached files (`'file' in attachment && attachment.file.size > 0`): read text from `attachment.file.text()`, then apply the same parse/fallback logic.

### Lib changes

1. Add `Json = 'json'` to `AttachmentContentType` enum (`libs/attachment-canvas/src/types/attachment-canvas.ts`).
2. Add `JsonCanvasContent` interface to `libs/attachment-canvas/src/models/attachment-canvas.ts`:
   ```ts
   export interface JsonCanvasContent {
     type: AttachmentContentType.Json;
     /** Already-parsed JSON value. The lib never calls JSON.parse. */
     value: unknown;
   }
   ```
3. Add `JsonCanvasContent` to the `AttachmentCanvasContent` union.
4. In `AttachmentCanvas`, add a `Json` case:
   ```tsx
   {content.type === AttachmentContentType.Json && (
     <div dir="ltr" className="h-full overflow-auto p-4">
       <JsonView data={content.value} />
     </div>
   )}
   ```
5. Export `JsonCanvasContent` from `libs/attachment-canvas/src/index.ts`.
6. Add `react-json-view-lite` to `libs/attachment-canvas/package.json` `peerDependencies`.

### Rendering

- The JSON tree is collapsible/expandable at any depth.
- The body scrolls vertically if the content exceeds the panel height.
- Download button is shown (same behavior as `PlainText` and `Markdown`).
- Theming: `react-json-view-lite` CSS variables should be mapped to the app's color tokens (light/dark). A wrapper CSS class in `AttachmentCanvas.module.scss` applies the variable overrides so the viewer matches the panel's color scheme.

### RTL

The JSON tree container carries `dir="ltr"` because `react-json-view-lite` uses physical (left-anchored) CSS properties. JSON key–value structure has no intrinsic text direction; always-LTR is correct behavior here.

### i18n

No new i18n keys.

### Accessibility

No changes beyond the panel chrome documented in `canvas-panel`. The JSON tree is interactive (keyboard expand/collapse) per `react-json-view-lite`'s built-in behavior.

### Tests (unit)

- `AttachmentCanvas` renders the JSON tree viewer when `content.type === AttachmentContentType.Json`.
- `resolveJsonCanvasContent` returns `JsonCanvasContent` with the parsed value for valid JSON text.
- `resolveJsonCanvasContent` returns `PlainTextCanvasContent` with the raw string for malformed JSON.
- `resolveJsonCanvasContent` returns `null` for a non-OK response.
- `resolveJsonCanvasContent` reads and parses local file text for an attachment with a `.file` property.
- `useOpenAttachmentCanvas` routes `.json` to `resolveJsonCanvasContent`.
- `useOpenAttachmentCanvas` does **not** route `.jsonl` or `.ndjson` to `resolveJsonCanvasContent`.
