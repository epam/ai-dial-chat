## Capability: canvas

### Overview

The `AttachmentCanvas` side panel opens to the right of the main conversation area when a user activates an attachment. It renders file content in a resizable, closeable panel that stays alongside the conversation. Content type is resolved from the `DisplayAttachment` at the app layer and passed as a typed payload to the lib.

---

### Panel chrome

#### Open triggers

| Surface | Where in the codebase | Behavior |
|---|---|---|
| `MessageBubble` (user message) | `ConversationView.tsx` → `handleMessageAttachmentClick` | Open canvas |
| `MessageBubble` (assistant message) | `ConversationView.tsx` → `handleMessageAttachmentClick` | Open canvas |
| `CollapsedGroup` stage attachments | `ConversationMessageItem.tsx` via `onAttachmentClick` | Open canvas |
| `ConversationInput` tray (new message) | `ConversationRoute.tsx` → `handleAttachmentClick` | Open canvas |
| `EditMessageInput` tray | `ConversationView.tsx` → `handleInputAttachmentClick` | Open canvas |
| `ConversationSourcesPanel` (attachment card) | `ConversationSourcesPanel.tsx` → `handleAttachmentClick` | Open canvas if previewable (closes source panel), fall back to anchor-download if `openAttachmentCanvas` returns `false` |
| `ConversationSourcesPanel` (source link) | `ConversationSourcesPanel.tsx` → `handleSourceClick` | Builds a `DisplayAttachment` from `QuotationSource` (`url`, `title`, `contentType`); opens canvas if previewable (closes source panel); falls back to `window.open` for web URLs or anchor-download for DIAL file IDs when `openAttachmentCanvas` returns `false` |

#### Open behavior

1. User activates an attachment card.
2. `useOpenAttachmentCanvas` (app hook at `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) resolves content from the `DisplayAttachment` (fetching file bytes if needed).
3. Hook calls `openCanvas(content, fileName)` from `useAttachmentCanvas()`.
4. `AttachmentCanvasContext` updates `isOpen = true`, `content`, and `fileName`.
5. `AttachmentCanvasContainer` (rendered in `app.tsx`) re-renders the panel open.

#### Auto-close

The canvas closes when the URL `pathname` changes (conversation switch, catalog navigation, new chat). Implemented via a `useEffect` in `apps/chat/src/app/app.tsx` that calls `closeCanvas()` on every `pathname` change.

#### Layout

- **Position**: right edge of the conversation layout (`apps/chat/src/app/app.tsx`). Always on the physical right regardless of text direction — a viewer panel is not a directional element.
- **Header**: file name (truncated) on the start side; action buttons + close icon button on the end side.
- **Download button**: shown only when `onDownload` is provided **and** `isDownloadable(content)` is `true`. `isDownloadable` returns `false` for `content.type === Unsupported` (no `url`) and for `content.type === Error` with `errorType === Forbidden` (see "Error rendering" below) — the download button is disabled/hidden in both cases.
- **Close button**: calls `onClose` (`closeCanvas`).
- **Resizability**: enabled on desktop, disabled on mobile (`isMobile` prop from `useIsMobile()`).
- **Width defaults**: 560 px default, 320 px min, 960 px max. Width is not persisted between sessions.
- **Both panels**: `ConversationSourcesPanel` and `AttachmentCanvas` cannot be open simultaneously. Opening the canvas from the source panel closes the source panel first (calls `closeSourcesPanel()` before `openCanvas()`). Opening the canvas from any other surface does not affect the source panel state.
- **Conversation panel**: The conversation history panel (`isHistoryPanelOpen`) is automatically closed when the canvas opens. Implemented via a `useEffect` in `apps/chat/src/app/app.tsx` that watches `isCanvasOpen` and calls `closeHistoryPanel()` whenever it becomes `true`.

#### i18n

All app-level strings are in `AttachmentCanvasI18nKeys` (`apps/chat/src/constants/translation-keys.ts`):

| Key | en.json value |
|---|---|
| `AriaLabel` | `"Attachment preview"` |
| `CloseLabel` | `"Close attachment preview"` |
| `DownloadLabel` | `"Download attachment"` |
| `UnsupportedLabel` | `"Preview is not supported for this file"` |
| `LoadErrorLabel` | `"Failed to load file"` |
| `ForbiddenErrorLabel` | `"You don't have permission to access this file"` |
| `CopyAsMarkdown` | `"Copy as Markdown"` |
| `Copied` | `"Copied!"` |

Lib-level string props use English defaults and are overridden by the app via `AttachmentCanvasContainer`.

#### Accessibility

- `SidebarPanel` renders with `role="complementary"` and `aria-label` from the `ariaLabel` prop.
- `aria-hidden="true"` is set on the panel when closed.
- Close, download, and copy buttons carry `aria-label` strings passed as props.
- Keyboard: all header buttons are reachable via Tab.

#### RTL

- The panel is physically right-anchored. No logical-property flip is needed for the chrome.
- Header content (file name and action buttons) uses `start`/`end` layout — no physical direction classes.

#### Feature flag

None. The canvas is always available to authenticated users.

---

### Content type routing

`useOpenAttachmentCanvas` maps a `DisplayAttachment` to a content payload. For `AttachmentType.File` attachments, `openFileCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) first checks whether the attachment is reference-only (`attachment.url == null && attachment.referenceUrl != null` — a RAG/search-grounding chunk). When true, it calls `referenceAttachmentToPdfCanvasContent({ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name })`; if that returns a non-`null` `PdfCanvasContent` (the `referenceUrl` targets a `.pdf`, optionally with a `#page=N` fragment), the canvas opens with it immediately and no further routing runs. If it returns `null`, routing falls through unchanged — this applies uniformly to `CollapsedGroup` stage attachments and the plain attachment tray, so a reference-only PDF-page chunk (e.g. `reference_url: 'files/{bucket}/report.pdf#page=81'`) opens the actual referenced PDF at the referenced page instead of rendering its own `data`/`contentType` as Markdown or plain text. Otherwise, it checks for a missing `contentType` with inline data (see "No-type inline-data fallback" below), then runs MIME-type routing (for stage attachments that carry a `contentType` but no file extension), then extension-based routing (lowercased):

| MIME type / Extension(s) | Resolver | Content type returned |
|---|---|---|
| Reference-only, PDF-page-detectable `referenceUrl` | `referenceAttachmentToPdfCanvasContent` | `PdfCanvasContent` (scrolled to the referenced page when present) |
| No `contentType` (empty string) **and** `attachment.data != null` | `resolveTextCanvasContent` | `PlainTextCanvasContent` |
| `text/markdown` MIME | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `application/json` MIME | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` |
| `application/pdf` MIME | `resolvePdfCanvasContent` | `PdfCanvasContent` |
| `md`, `markdown` extension | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `json` extension | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` (parse failure) |
| `pdf` extension | `resolvePdfCanvasContent` | `PdfCanvasContent` |
| `image/*` MIME | `resolveImageCanvasContent` | `ImageCanvasContent` |
| Other text-previewable (see `TEXT_EXTENSIONS`) | `resolveTextCanvasContent` | `PlainTextCanvasContent` |
| Everything else | `createUnsupportedCanvasContent` | `UnsupportedCanvasContent` |

Extension checks for `md`/`markdown` and `json` run *before* the generic `isTextPreviewable` branch.

---

### Error rendering

The canvas distinguishes two failure states, both represented by `ErrorCanvasContent { type: AttachmentContentType.Error; errorType: AttachmentErrorType; url?: string }` (`AttachmentErrorType` is `LoadFailed | Forbidden`):

| `errorType` | Cause | Body message (`AttachmentCanvasProps`) | Download button |
|---|---|---|---|
| `LoadFailed` | Fetch threw (network error) or returned a non-`403` non-OK status | `loadErrorLabel`, default `"Failed to load file"` | Shown when `url` is present (retry via re-download is still possible) |
| `Forbidden` | Fetch returned HTTP `403` | `forbiddenErrorLabel`, default `"You don't have permission to access this file"` | **Always hidden** — `isDownloadable` returns `false` for `Forbidden` regardless of `url` |

Both messages render centered in the body, the same layout slot as the `Unsupported` message. `isDownloadable(content)` (`libs/attachment-canvas/src/utils/download.ts`) drives the download button's visibility for all content types, including `Error`:

```ts
case AttachmentContentType.Error:
  return content.errorType !== AttachmentErrorType.Forbidden && content.url != null;
```

This is distinct from `Unsupported`: an unsupported file format is a client-side routing decision (the file loaded fine, previewing it just isn't implemented), while `Error` means the fetch itself failed — the panel never received usable bytes.

#### Where errors are produced

The app-level resolvers in `apps/chat/src/utils/attachment-canvas.ts` (`resolveAttachmentText`, `resolveAttachmentBlobUrl` — see "Shared content resolution helpers" below) classify a failed fetch by HTTP status and return an `ErrorCanvasContent` instead of `undefined`. Every `resolveXCanvasContent` function propagates that `ErrorCanvasContent` unchanged instead of wrapping it in its own content type. `useOpenAttachmentCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) treats a resolver's `ErrorCanvasContent` result the same as any other non-`null` content — it opens the canvas with it directly. `undefined`/`null` (no data source at all — no `url`, no inline `data`, no local `file`) still means "not previewable" and continues to route to `Unsupported` or `false`, unchanged from prior behavior.

`libs/attachment-canvas/src/utils/content.ts` exports `createLoadErrorCanvasContent(url?)` and `createForbiddenCanvasContent(url?)` helpers, mirroring `createUnsupportedCanvasContent(url?)`.

#### No-type inline-data fallback

Some attachments (e.g. an LLM-revised image prompt saved back onto the conversation) carry inline `data` but no `type`/`contentType` at all — `messageAttachmentToDisplayAttachment` then produces `contentType: ''` with no file extension in `name` to fall back on. Without a special case, such an attachment would fail every MIME/extension check, fail `isTextPreviewable(attachment.name)` (no extension), and incorrectly render as `UnsupportedCanvasContent` even though its `data` is plain, previewable text.

`openFileCanvas` special-cases this: when `attachment.contentType.toLowerCase()` is the empty string **and** `attachment.data != null`, it resolves content via `resolveTextCanvasContent(attachment)` immediately and returns `true` if non-`null`, before running the MIME-type `switch`. When `contentType` is empty but `attachment.data` is also absent (e.g. only a `url`), this fallback is skipped and routing falls through to the normal extension/`isTextPreviewable` path as before.

#### Content renderers

| `AttachmentContentType` | Payload field | Renderer |
|---|---|---|
| `Image` | `url: string` | `<img>` centered, `max-h-full max-w-full object-contain` |
| `PlainText` | `text: string` | `<pre>` with `whitespace-pre-wrap break-words` |
| `Markdown` | `text: string` | `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, neutral defaults |
| `Json` | `value: unknown` | `react-json-view-lite` `JsonView`, container has `dir="ltr"` |
| `Pdf` | `url: string; highlights?: InputHighlightData[]; selectedHighlightId?: string` | `PdfContent` (thumbnail sidebar + `DocumentPreview` from `@epam/ai-dial-react-pdf-highlighter`) |
| `Unsupported` | — | Centered "Preview not supported" message |
| `Error` | `errorType: AttachmentErrorType; url?: string` | Centered error message, text depends on `errorType` (see "Error rendering" below) |

---

### Markdown rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolveMarkdownCanvasContent` when `contentType === 'text/markdown'` (MIME, checked first) or when the lowercased file extension is `md` or `markdown`.

#### Content resolution

`resolveMarkdownCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts` delegates to the shared `resolveAttachmentText` helper (see "Shared content resolution helpers" below) and wraps a non-`undefined` result as `{ type: AttachmentContentType.Markdown, text }`. Returns `null` when `resolveAttachmentText` resolves to `undefined`.

Precedence (via `resolveAttachmentText`): inline base64 `attachment.data` (decoded to UTF-8 text) → fetched text from `resolveDialUrl(attachment)` → local `attachment.file.text()`.

#### Rendering

- `MarkdownRenderer` is rendered with neutral defaults: no `classNames` overrides, no custom `markdownComponents`, `isStreaming={false}`.
- The body wrapper (`h-full overflow-auto p-4`) provides scrolling; long documents scroll vertically.
- Code blocks use the app's current theme (`codeBlockTheme` prop on `AttachmentCanvasContainer` → forwarded to `MarkdownRenderer`).
- `MarkdownRenderer` uses logical Tailwind classes (`ps/pe`, `ms/me`, `border-s/e`) internally; no extra RTL handling needed at the canvas layer.

#### Copy as Markdown button

- An `IconMarkdown` button is shown to the **left** of the download button in `rightActions` when `content.type === Markdown`.
- After a successful click the icon switches to `IconCheck` for 2 s, then reverts. The toggle state is managed inside `AttachmentCanvas` (same pattern as `MessageActions`).
- The copy action is delegated via `onCopyMarkdown?: () => void`; `AttachmentCanvasContainer` provides it by calling `copyToClipboard(content.text)` when `content.type === Markdown`.

---

### JSON rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolveJsonCanvasContent` when `contentType === 'application/json'` (MIME, checked first) or when the lowercased file extension is exactly `json`. `.jsonl` and `.ndjson` are not routed here; they fall through to `resolveTextCanvasContent`.

#### Content resolution

`resolveJsonCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts`:

1. Resolve `text` via the shared `resolveAttachmentText` helper (inline base64 `attachment.data` decoded to UTF-8 text → fetched text from `resolveDialUrl(attachment)` → local `attachment.file.text()`). If `undefined`, return `null`.
2. Attempt `JSON.parse(text)`.
   - On success: return `{ type: AttachmentContentType.Json, value: parsed }`.
   - On `SyntaxError`: return `{ type: AttachmentContentType.PlainText, text }` — graceful degradation.

#### Rendering

- `react-json-view-lite` `JsonView` rendered inside `<div dir="ltr">` — the tree uses physical (left-anchored) CSS; `dir="ltr"` is correct in both LTR and RTL app modes.
- The tree is collapsible/expandable at any depth.
- Body scrolls vertically if content exceeds panel height.
- Theming: CSS variables in `AttachmentCanvas.module.scss` map `react-json-view-lite` tokens to the app's light/dark color scheme.
- Download button is shown (same as PlainText and Markdown).

---

### Stage attachment `data` field

DIAL Core extracts text from referenced documents (e.g. PDFs) server-side and stores it in `data` on stage attachments when saving the conversation. The SSE stream does **not** include `data` on stage attachment chunks.

To make server-computed `data` available in React state during a session, `useConversationStream.onComplete` reloads the conversation from the server after `saveConversation` succeeds:

```ts
await saveConversation(conversationPath, final);
if (!abortRef.current) {
  const refreshed = await getConversation(conversationPath);
  setConversation(refreshed);
  conversationRef.current = refreshed;
}
```

The reload is guarded by `!abortRef.current` to skip if the user has already started a new stream.

`DisplayAttachment.data?: string` carries this inline content through `toDisplayAttachment` to the canvas resolvers. Per the DTO contract (`MessageAttachment.data`, `libs/chat-shared/src/models/chat.ts`), `data` is documented as base64-encoded — but in practice some backends put already-decoded plain text in this field for text-based content types (e.g. OCR'd markdown containing non-Latin1 characters, which is not valid base64). The canvas resolvers therefore never assume `data` is valid base64: they attempt to base64-decode it and fall back to using it as-is (raw text, or raw bytes for binary content) when decoding fails (see "Shared content resolution helpers" below).

---

### Shared content resolution helpers

`apps/chat/src/utils/attachment-canvas.ts` defines two internal helpers used by every content resolver to avoid duplicating base64-handling and fetch-error-classification logic per content type. Both are `async` and can resolve to an `ErrorCanvasContent` (see "Error rendering" above) instead of their success value when a DIAL fetch fails.

- **`resolveAttachmentBlobUrl(attachment): Promise<string | ErrorCanvasContent | undefined>`** — resolves a displayable URL for an attachment's binary content, in this precedence order:
  1. Local `attachment.file` (locally-picked, not-yet-uploaded) → `URL.createObjectURL(attachment.file)`.
  2. `resolveDialUrl(attachment)` — an already-uploaded DIAL `files/` URL (checks `attachment.url` then `attachment.referenceUrl`). The URL is fetched immediately (`fetch(dialUrl)`): on success the response body is turned into a `Blob` and returned as an object URL (`URL.createObjectURL`); on a non-OK response or a thrown network error, an `ErrorCanvasContent` is returned instead (see "Where errors are produced" above) — `errorType: Forbidden` for HTTP `403`, `errorType: LoadFailed` otherwise.
  3. `attachment.previewUrl` — set for `AttachmentType.Image` attachments; already a `data:` URL when the source was inline base64 (see `message-attachment-to-display.ts`).
  4. Inline `attachment.data`, passed to `base64ToBlobUrl(data, attachment.contentType)`, which builds a `Blob` (`type: attachment.contentType`) from the decoded bytes and returns an object URL via `URL.createObjectURL`.
  5. Otherwise `undefined`.
  Used by `resolveImageCanvasContent` and `resolvePdfCanvasContent`. Fetching the DIAL URL eagerly (rather than handing the raw URL to `<img src>` or the PDF viewer) is what lets the canvas detect a `403` before rendering — the resulting `blob:` object URL is then consumed by `<img>` / `DocumentPreview` exactly as before, with no extra network round-trip (blob URLs resolve from the in-memory blob store).
- **`resolveAttachmentText(attachment): Promise<string | ErrorCanvasContent | undefined>`** — resolves an attachment's textual content, in this precedence order:
  1. Inline `attachment.data`, passed to `base64ToText(data)`.
  2. `resolveDialUrl(attachment)` fetched via `fetch(...)`; returns the response text on success, or an `ErrorCanvasContent` on a non-OK response or thrown network error (same classification as above).
  3. Local `attachment.file.text()`.
  4. Otherwise `undefined`.
  Used by `resolveTextCanvasContent`, `resolveMarkdownCanvasContent`, and `resolveJsonCanvasContent`.

Every `resolveXCanvasContent` wrapper checks its helper's result: an `ErrorCanvasContent` is returned as-is (unwrapped further), `undefined` becomes `null` (no source — "not previewable"), and any other value is wrapped in that resolver's own content type as before.

Both helpers build on a shared primitive, **`tryBase64ToBytes(base64): Uint8Array | undefined`**, which calls `atob` and returns the decoded bytes, or `undefined` if `atob` throws (e.g. `InvalidCharacterError` for a string containing characters outside the Latin1 range — a sign that `data` was not actually base64-encoded).

- `base64ToBlobUrl(data, mimeType)`: uses `tryBase64ToBytes(data)` when it succeeds; otherwise falls back to `new TextEncoder().encode(data)` (treats `data` as already-raw content) before building the `Blob`. Either way it never throws.
- `base64ToText(base64)`: uses `tryBase64ToBytes(base64)` decoded via `TextDecoder` when it succeeds; otherwise returns `base64` unchanged (it was already plain text). Either way it never throws.

This graceful fallback is required because some backends put already-decoded plain text in `data` for text-based content (see "Stage attachment `data` field" above) — attempting a strict base64 decode on that text previously crashed the canvas open flow with an uncaught `InvalidCharacterError`.

---

### Image rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolveImageCanvasContent` when `attachment.type === AttachmentType.Image`.

#### Content resolution

`resolveImageCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts` resolves `url` via the shared `resolveAttachmentBlobUrl` helper. A resolved `ErrorCanvasContent` is returned as-is; a resolved string is wrapped as `{ type: AttachmentContentType.Image, url }`; `undefined` returns `null`.

This covers stage attachments (e.g. annotated PDF page thumbnails from the DIAL Annotation API) that carry the image as inline base64 `data` with no `url` — `message-attachment-to-display.ts` already synthesizes a `data:image/...;base64,...` `previewUrl` for such attachments, which `resolveAttachmentBlobUrl` picks up directly.

#### Rendering

`<img>` centered, `max-h-full max-w-full object-contain` (see "Content renderers" table above).

---

### PDF rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolvePdfCanvasContent` when `contentType === 'application/pdf'` (MIME, checked first) or when the lowercased file extension is `pdf`. PDF routing runs before the generic `isTextPreviewable` branch.

#### Content resolution

`resolvePdfCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts` is `async` and resolves `url` via the shared `resolveAttachmentBlobUrl` helper (see "Shared content resolution helpers" below). A resolved `ErrorCanvasContent` is returned as-is; a resolved string is wrapped as `{ type: AttachmentContentType.Pdf, url }`; `undefined` returns `null`.

Precedence (via `resolveAttachmentBlobUrl`): local `attachment.file` (`URL.createObjectURL`) → `resolveDialUrl(attachment)` (fetched eagerly; a non-OK response or network error yields `ErrorCanvasContent` instead) → `attachment.previewUrl` → inline base64 `attachment.data` decoded into a `Blob` (`type: attachment.contentType`) and turned into an object URL via `URL.createObjectURL`.

This covers stage attachments (e.g. from the DIAL Annotation API) that carry the PDF as inline base64 `data` with no `url` — `DocumentPreview` receives a `blob:` object URL and loads it the same way it would a remote URL. A DIAL-hosted PDF is fetched once at resolution time (to classify load/permission failures before rendering); `DocumentPreview`'s own `loadFileCb` then resolves that `blob:` URL from the in-memory blob store, so this does not add a second network round-trip.

Citation-preview PDFs (see "Citation preview" below) build their `PdfCanvasContent.url` directly from the annotation's source `attachment.url` without going through `resolveAttachmentBlobUrl` — a load failure for that path surfaces only inside `DocumentPreview` itself, not as `ErrorCanvasContent`. This is a known gap, not covered by this section.

#### Rendering

The `PdfContent` component (`libs/attachment-canvas/src/components/AttachmentCanvas/PdfContent.tsx`) wraps `DocumentPreview` and adds a thumbnail sidebar.

**Layout** — `flex h-full overflow-hidden`:
- **Thumbnail sidebar** (`w-30 shrink-0 overflow-auto`) — rendered once `totalPages > 0`. Displays one `PageThumbnail` per page. Clicking a thumbnail calls `viewerApiRef.current?.navigateToPage(pageNum)` and updates `selectedPage` state.
- **Viewer pane** (`min-w-0 flex-1 overflow-hidden`) — contains `DocumentPreview`.

**`selectedPage` state** — tracks which thumbnail is highlighted (selected):
- Initialised via a lazy `useState` initializer: finds the `InputHighlightData` entry whose `id` matches `selectedHighlightId` and returns its first `BBox.page`; falls back to `1` when no match is found.
- A `useEffect` keyed on `[selectedHighlightId, highlights]` updates `selectedPage` when the user opens a different citation in the same PDF (new `selectedHighlightId` prop on the already-mounted component).
- `PdfContent` is keyed by `content.url` in `AttachmentCanvas` — the component stays mounted across same-PDF citation changes, so there is no blink or document reload.
- A second `useEffect` keyed on `[selectedPage, totalPages]` calls `scrollIntoView({ block: 'center', behavior: 'smooth' })` on the selected thumbnail's wrapper `div` (tracked in `thumbnailNodeRefs`). Including `totalPages` in the deps ensures the scroll fires once the thumbnail sidebar has been rendered for the first time.
- Clicking a thumbnail calls `handleSelectPage`, which sets `selectedPage` directly and calls `viewerApiRef.current?.navigateToPage(pageNum)`.

`DocumentPreview` props:

| Prop | Value |
|---|---|
| `fileUrl` | `content.url` — resolved URL or object URL |
| `loadFileCb` | `loadPdf` prop (optional); falls back to `fetchBlobFromUrl` from `libs/attachment-canvas/src/utils/download.ts` (fetches the URL, throws on non-OK status, returns `Blob`) |
| `highlights` | `content.highlights ?? []` — highlight regions; empty when no citation context |
| `selectedHighlightId` | `content.selectedHighlightId` — viewer scrolls to this highlight on load |
| `showOccurrences` | `false` — occurrence counter suppressed |
| `thumbnailPageNumbers` | `[1 … totalPages]` — drives thumbnail generation inside the library |
| `onTotalPagesChange` | sets `totalPages` state, which controls sidebar visibility and `thumbnailPageNumbers` |
| `onThumbnailsLoaded` | merges newly loaded thumbnail URLs into `thumbnails` state (`Map<number, string>`) |
| `onViewerReady` | stores the `PdfViewerApi` reference used for programmatic page navigation |

No `title` prop is passed — toolbar title is hidden.

Body wrapper class: `h-full overflow-hidden` — no padding; the viewer manages its own scrolling.

The `loadPdf` prop is optional on `PdfContent`, `AttachmentCanvas`, and `AttachmentCanvasContainer`. The default (`fetchBlobFromUrl`) works for cookie-based DIAL auth. The app layer can supply a custom `loadPdf` callback if it needs to add auth headers.

#### Download

PDF is downloadable. `isDownloadable` returns `true` for `PdfCanvasContent`. `downloadAttachmentContent` uses `content.url` as the anchor `href` directly (same pattern as `ImageCanvasContent`).

---

### Citation preview

When a user clicks "Preview" in a `CitationDropdown`, `useCitationMarkdownComponents.onPreview` opens the canvas with the full source file.

#### PDF sources (highlights)

When `annotation.body.source.attachment.type === 'application/pdf'`:

1. Find the `AnnotationGroup` that owns the clicked annotation (by `sourceUrl`).
2. `annotationsToPdfHighlights(group.annotations)` — maps every annotation whose `body.selector` contains one or more `PdfBBoxSelector` entries (`type: 'pdf_bbox'`) to an `InputHighlightData`. Each annotation becomes one highlight whose `bboxes` list collects all its `pdf_bbox` selectors. The highlight `id` is `annotation.index` when present, otherwise the annotation's position in the group.
3. `selectedHighlightId` is computed for the clicked annotation using the same ID formula, so the viewer scrolls to it on load.
4. `fileName` is derived from the annotation's `attachment`: `attachment.title` is used when present; otherwise the last path segment of `attachment.url` is URL-decoded with `decodeURIComponent` (so `%20` → space, etc.).
5. `openCanvas` is called directly with `PdfCanvasContent { type: Pdf, url, highlights, selectedHighlightId }` and the resolved `fileName`.
6. Annotations whose `body.selector` carries no `pdf_bbox` entries produce no highlight and are silently skipped.

#### Non-PDF sources

`annotationToDisplayAttachment` converts the annotation's `AttachmentResource` to a `DisplayAttachment` and calls `onAttachmentPreview` — the generic canvas open path.

#### Selector type

`AnnotationBody.selector` may be a single `AnnotationSelector` or an array. Only entries with `type === 'pdf_bbox'` are mapped; all other selector types are ignored. The `PdfBBoxSelector` shape:

```ts
interface PdfBBoxSelector {
  type: 'pdf_bbox';
  page: number;   // 1-based
  x1: number; y1: number; x2: number; y2: number;
}
```
