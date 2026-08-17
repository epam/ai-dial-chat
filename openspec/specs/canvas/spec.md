# canvas Specification

## Purpose

The canvas side panel: its chrome, open and auto-close behavior, layout, and the content-type routing that picks a viewer.

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
3. Hook calls `openCanvas(content, fileName, attachmentId)` from `useAttachmentCanvas()`. For message attachments, `attachmentId` is a message-scoped composite key (`` `${messageIndex}:${attachment.id}` ``, built by `ConversationView.tsx`) rather than the raw `DisplayAttachment.id` — `id` alone is derived from content and can recur across different messages. Other callers (edit-message tray, `ConversationSourcesPanel`) omit the override and get the raw `attachment.id` default.
4. `AttachmentCanvasContext` updates `isOpen = true`, `content`, `fileName`, and `attachmentId`. The context treats `attachmentId` as an opaque key — it has no knowledge of the composite-key format.
5. `AttachmentCanvasContainer` (rendered in `app.tsx`) re-renders the panel open.
6. `ConversationView.tsx` reads `attachmentId` back from `useAttachmentCanvas()` and passes it to each `ConversationMessageItem` as `selectedAttachmentKey`. Each `ConversationMessageItem` strips its own `` `${index}:` `` prefix (or renders `undefined` if the key doesn't match its own message index) before forwarding a message-scoped `selectedAttachmentId` through `MessageBubble` → `AttachmentGroup`, so only the tile that actually opened the canvas renders selected, even if another message has an attachment with the same content-derived `id` (see `attachment-input-lib` spec, "AttachmentCard, AttachmentGroup, and MessageBubble support a selected-tile visual state").

#### Auto-close

The canvas closes when the URL `pathname` changes (conversation switch, catalog navigation, new chat). Implemented via a `useEffect` in `apps/chat/src/app/app.tsx` that calls `closeCanvas()` on every `pathname` change.

#### Layout

- **Position**: right edge of the conversation layout (`apps/chat/src/app/app.tsx`). Always on the physical right regardless of text direction — a viewer panel is not a directional element.
- **Header**: file name (truncated) on the start side; action buttons + close icon button on the end side.
- **Download button**: shown only when `onDownload` is provided **and** `isDownloadable(content)` is `true`. `isDownloadable` returns `false` for `content.type === Unsupported` when `url` is `null`, `true` when `url` is present; and always `false` for `content.type === Error` with `errorType === Forbidden` (see "Error rendering" below).
- **Close button**: calls `onClose` (`closeCanvas`).
- **Resizability**: enabled on desktop, disabled on mobile (`isMobile` prop from `useIsMobile()`).
- **Width defaults**: ~50% of viewport on desktop (capped at `canvasMaxWidth`; see below), full viewport on mobile. 600 px min. Max is `usePanelMaxWidth()` — `Math.max(0, viewportWidth − 400)`, reactive to window resize — so the chat area retains at least 400 px at all times. Width is not persisted between sessions.
- **Resize constraint shared with sidebar**: both `AttachmentCanvas` and `ConversationSourcesPanel` derive their `maxWidth` from the shared `usePanelMaxWidth` hook (`apps/chat/src/hooks/usePanelMaxWidth.ts`), which guarantees `MIN_CONTENT_AREA_WIDTH = 400 px` of remaining chat space. The sidebar has its own `minWidth` of 312 px; the canvas has a separate `minWidth` of 600 px.
- **Both panels**: `ConversationSourcesPanel` and `AttachmentCanvas` are mutually exclusive — opening either one closes the other. The primary path is synchronous: `useOpenAttachmentCanvas` calls `closePanel()` and `closeSourcesPanel()` at the start of `openAttachmentCanvas`, before any async content resolution, so panels disappear on click rather than after the file fetch completes. `SourcesSidebarToggle` calls `closeCanvas()` synchronously before `handleOpen()` for the reverse direction. A `useEffect` in `app.tsx` that watches `isCanvasOpen` acts as a safety net for the few call sites that call `openCanvas` directly (citation preview, collapsed stage attachments).
- **Conversation panel**: The conversation history panel (`isPanelOpen`, managed by `ConversationPanelContext`) and `AttachmentCanvas` are mutually exclusive — opening either one closes the other. `useOpenAttachmentCanvas` calls `closePanel()` synchronously before async content resolution; `togglePanel` in `app.tsx` calls `closeCanvas()` before opening the panel. The `isCanvasOpen` safety-net effect in `app.tsx` covers direct `openCanvas` call sites.

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
| `CopyAsMarkdown` | `"Copy markdown"` |
| `Copied` | `"Copied!"` |
| `HtmlFrameBlocked` | `"This page cannot be displayed in preview"` |
| `HtmlOpenInNewTab` | `"Open in new tab"` |
| `HtmlViewSource` | `"View source"` |
| `HtmlViewRendered` | `"View rendered"` |

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

`useOpenAttachmentCanvas` maps a `DisplayAttachment` to a content payload. The top-level `switch` on `attachment.type` handles `Image`, `Audio`, `File`, `Pasted`, and `Prompt` before any extension/MIME routing runs:

- **`Image`** — `resolveImageCanvasContent` (synchronous); closes panels before calling `openCanvas`.
- **`Audio`** — uses `attachment.playUrl ?? attachment.url`; if neither is present returns `false`. Calls `openCanvas` directly with `{ type: AttachmentContentType.Audio, url, mimeType: attachment.contentType || undefined }`. Does not close other panels (audio canvas is additive).
- **`File`** — calls `closePanel()`, `closeSourcesPanel()`, and `openCanvasLoading(attachment.name)` synchronously, then delegates to `openFileCanvas` (async). If `openFileCanvas` returns `false` the loading state is cleared by calling `closeCanvas()`.
- **`Pasted` / `Prompt`** — same synchronous close+loading pattern, then `resolveTextCanvasContent`.

For `AttachmentType.File` attachments, `openFileCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) first checks whether the attachment is reference-only (`attachment.url == null && attachment.referenceUrl != null` — a RAG/search-grounding chunk). When true, it calls `referenceAttachmentToPdfCanvasContent({ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name })`; if that returns a non-`null` `PdfCanvasContent` (the `referenceUrl` targets a `.pdf`, optionally with a `#page=N` fragment), the canvas opens with it immediately and no further routing runs. If it returns `null`, routing falls through unchanged — this applies uniformly to `CollapsedGroup` stage attachments and the plain attachment tray, so a reference-only PDF-page chunk (e.g. `reference_url: 'files/{bucket}/report.pdf#page=81'`) opens the actual referenced PDF at the referenced page instead of rendering its own `data`/`contentType` as Markdown or plain text. Otherwise, it checks for a missing `contentType` with inline data (see "No-type inline-data fallback" below), then runs MIME-type routing (for stage attachments that carry a `contentType` but no file extension), then extension-based routing (lowercased):

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
| `html`, `htm` extension | `resolveHtmlCanvasContent` | `HtmlCanvasContent` |
| Other text-previewable (see `TEXT_EXTENSIONS`, excluding `html`/`htm`) | `resolveCodeCanvasContent` | `CodeCanvasContent` |
| Everything else | `createUnsupportedCanvasContent` | `UnsupportedCanvasContent` |

Extension checks for `md`/`markdown` and `json` run *before* the generic `isTextPreviewable` branch. The `html`/`htm` branch runs before the generic `isTextPreviewable` branch. The `isTextPreviewable` branch now routes to `resolveCodeCanvasContent` (returning `CodeCanvasContent`) instead of `resolveTextCanvasContent`.

---

### Visualizer content type

The requirements below extend the canvas with a `Visualizer` content type routed to a registry-driven iframe renderer (see the `custom-visualizers` capability for the registry, the postMessage protocol, and the connector classes).

---

### Error rendering

The canvas distinguishes two failure states, both represented by `ErrorCanvasContent { type: AttachmentContentType.Error; errorType: AttachmentErrorType; url?: string }` (`AttachmentErrorType` is `LoadFailed | Forbidden`):

| `errorType` | Cause | Body message (`AttachmentCanvasProps`) | Download button |
|---|---|---|---|
| `LoadFailed` | Fetch threw (network error) or returned a non-`403` non-OK status | `loadErrorLabel`, default `"Failed to load file"` | Shown when `url` is present (retry via re-download is still possible) |
| `Forbidden` | Fetch returned HTTP `403` | `forbiddenErrorLabel`, default `"You don't have permission to access this file"` | **Always hidden** — `isDownloadable` returns `false` for `Forbidden` regardless of `url` |

Both messages render centered in the body, the same layout slot as the `Unsupported` message. `isDownloadable(content)` (`libs/attachment-canvas/src/utils/download.ts`) drives the download button's visibility for all content types, including `Error` and `Unsupported`:

```ts
case AttachmentContentType.Unsupported:
  return content.url != null;
case AttachmentContentType.Error:
  return content.errorType !== AttachmentErrorType.Forbidden && content.url != null;
```

`Unsupported` (file loaded fine but previewing is not implemented) shows the download button when a `url` is available so the user can still retrieve the file. `Error` (the fetch itself failed) shows the download button only when `url` is present and the failure was not `Forbidden` — a `403` means the user cannot access the file at all, so offering a download would fail identically.

#### Where errors are produced

The app-level resolvers in `apps/chat/src/utils/attachment-canvas.ts` (`resolveAttachmentText`, `resolveAttachmentBlobUrl` — see "Shared content resolution helpers" below) classify a failed fetch by HTTP status and return an `ErrorCanvasContent` instead of `undefined`. Every `resolveXCanvasContent` function propagates that `ErrorCanvasContent` unchanged instead of wrapping it in its own content type. `useOpenAttachmentCanvas` treats a resolver's `ErrorCanvasContent` result the same as any other non-`null` content — it opens the canvas with it directly. `undefined`/`null` (no data source at all) still means "not previewable" and routes to `Unsupported` or `false`, unchanged.

**Images are excluded from this path.** `resolveImageCanvasContent` is synchronous and never fetches, so it cannot return `ErrorCanvasContent`. Image load failures (network error, 403, CORS) surface as an inline error state in the `ImageContent` renderer via `<img onError>` (see "Image rendering" above).

`libs/attachment-canvas/src/utils/content.ts` exports `createLoadErrorCanvasContent(url?)` and `createForbiddenCanvasContent(url?)` helpers, mirroring `createUnsupportedCanvasContent(url?)`.

#### No-type inline-data fallback

Some attachments (e.g. an LLM-revised image prompt saved back onto the conversation) carry inline `data` but no `type`/`contentType` at all — `messageAttachmentToDisplayAttachment` then produces `contentType: ''` with no file extension in `name` to fall back on. Without a special case, such an attachment would fail every MIME/extension check, fail `isTextPreviewable(attachment.name)` (no extension), and incorrectly render as `UnsupportedCanvasContent` even though its `data` is plain, previewable text.

`openFileCanvas` special-cases this: when `attachment.contentType.toLowerCase()` is the empty string **and** `attachment.data != null`, it resolves content via `resolveTextCanvasContent(attachment)` immediately and returns `true` if non-`null`, before running the MIME-type `switch`. When `contentType` is empty but `attachment.data` is also absent (e.g. only a `url`), this fallback is skipped and routing falls through to the normal extension/`isTextPreviewable` path as before.

#### Content renderers

| `AttachmentContentType` | Payload field | Renderer |
|---|---|---|
| `Image` | `url: string` | `<img>` centered, `max-h-full max-w-full object-contain` |
| `Audio` | `url: string; mimeType?: string` | Native `<audio controls>` with optional `<source type>` child; centered, `w-full max-w-sm` |
| `PlainText` | `text: string` | `<pre>` with `whitespace-pre-wrap break-words` |
| `Markdown` | `text: string` | `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, neutral defaults |
| `Json` | `value: unknown` | `react-json-view-lite` `JsonView`, container has `dir="ltr"` |
| `Pdf` | `url: string; highlights?: InputHighlightData[]; selectedHighlightId?: string` | `PdfContent` (collapsible thumbnails section/panel + `DocumentPreview` from `@epam/ai-dial-react-pdf-highlighter`) |
| `Code` | `text: string; language?: string` | `CodeContent` (`react-syntax-highlighter` PrismLight inside `dir="ltr"`) |
| `Html` | `srcdoc?: string; url?: string` | `HtmlContent` (sandboxed `<iframe>`) |
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

#### Copy markdown button

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
  2. `resolveDialUrl(attachment)` — an already-uploaded DIAL `files/` URL. The URL is fetched via the module-level `fetchDialBlob` helper (LRU-cached — see "LRU fetch cache" below): on success the `Blob` is turned into an object URL (`URL.createObjectURL`); on a non-OK response or a thrown network error, an `ErrorCanvasContent` is returned instead (see "Where errors are produced" above) — `errorType: Forbidden` for HTTP `403`, `errorType: LoadFailed` otherwise.
  3. `attachment.previewUrl` — a `data:` URL when the source was inline base64 (see `message-attachment-to-display.ts`).
  4. Inline `attachment.data`, passed to `base64ToBlobUrl(data, attachment.contentType)`, which builds a `Blob` (`type: attachment.contentType`) from the decoded bytes and returns an object URL via `URL.createObjectURL`.
  5. Otherwise `undefined`.
  Used by `resolvePdfCanvasContent` only. Images skip this helper entirely (see "Image rendering" above). Fetching the DIAL URL eagerly (rather than handing the raw URL to the PDF viewer) lets the canvas detect a `403` before rendering — the resulting `blob:` object URL is then consumed by `DocumentPreview` from the in-memory blob store, so this does not add a second network round-trip.
- **`resolveAttachmentText(attachment): Promise<string | ErrorCanvasContent | undefined>`** — resolves an attachment's textual content, in this precedence order:
  1. Inline `attachment.data`, passed to `base64ToText(data)`.
  2. `resolveDialUrl(attachment)` fetched via `fetch(...)`; returns the response text on success, or an `ErrorCanvasContent` on a non-OK response or thrown network error (same classification as above).
  3. Local `attachment.file.text()`.
  4. Otherwise `undefined`.
  Used by `resolveTextCanvasContent`, `resolveMarkdownCanvasContent`, and `resolveJsonCanvasContent`.

Every `resolveXCanvasContent` wrapper checks its helper's result: an `ErrorCanvasContent` is returned as-is (unwrapped further), `undefined` becomes `null` (no source — "not previewable"), and any other value is wrapped in that resolver's own content type as before.

#### LRU fetch cache

`apps/chat/src/utils/attachment-canvas.ts` maintains two module-level LRU caches (from the `lru-cache` package, v10+) keyed by DIAL download URL:

- **`blobCache`** — `LRUCache<string, Promise<Blob>>`, max 10 entries. Used by `resolvePdfCanvasContent` via `resolveAttachmentBlobUrl`. Each canvas open creates a fresh `URL.createObjectURL(blob)` from the cached `Blob` (zero network, trivial memory).
- **`textCache`** — `LRUCache<string, Promise<string>>`, max 50 entries. Used by `resolveMarkdownCanvasContent`, `resolveJsonCanvasContent`, and `resolveTextCanvasContent` via `resolveAttachmentText`.

Both caches store the `Promise` itself so that concurrent opens of the same URL share one in-flight fetch rather than issuing duplicate requests. A rejected promise is removed from the cache immediately, allowing the next open to retry the network.

`clearAttachmentCache()` (exported from `attachment-canvas.ts`) clears both caches. It is called in the `pathname` `useEffect` in `apps/chat/src/app/app.tsx` on every navigation (conversation switch, catalog, new chat), bounding cached data to the current conversation session.

Images do **not** use these caches — `resolveImageCanvasContent` is synchronous and returns the BFF URL directly (see "Image rendering" above). The browser's own HTTP cache deduplicates the `<img src>` request made by the canvas with the identical `<img>` element already rendered in the conversation view.

---

Both helpers build on a shared primitive, **`tryBase64ToBytes(base64): Uint8Array | undefined`**, which calls `atob` and returns the decoded bytes, or `undefined` if `atob` throws (e.g. `InvalidCharacterError` for a string containing characters outside the Latin1 range — a sign that `data` was not actually base64-encoded).

- `base64ToBlobUrl(data, mimeType)`: uses `tryBase64ToBytes(data)` when it succeeds; otherwise falls back to `new TextEncoder().encode(data)` (treats `data` as already-raw content) before building the `Blob`. Either way it never throws.
- `base64ToText(base64)`: uses `tryBase64ToBytes(base64)` decoded via `TextDecoder` when it succeeds; otherwise returns `base64` unchanged (it was already plain text). Either way it never throws.

This graceful fallback is required because some backends put already-decoded plain text in `data` for text-based content (see "Stage attachment `data` field" above) — attempting a strict base64 decode on that text previously crashed the canvas open flow with an uncaught `InvalidCharacterError`.

---

### Image rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolveImageCanvasContent` when `attachment.type === AttachmentType.Image`.

#### Content resolution

`resolveImageCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts` is **synchronous** (`ImageCanvasContent | null`) and never issues a `fetch`. Resolution priority:

1. Local `attachment.file` → `URL.createObjectURL(file)` (locally-picked, not yet uploaded).
2. `resolveDialUrl(attachment)` → the BFF download URL is passed to `<img src>` directly. The browser's HTTP cache deduplicates it with the `<img>` already rendered in the conversation view. Load failures are detected via `<img onError>` in the renderer (see "Rendering" below).
3. `attachment.previewUrl` — typically a `data:image/...;base64,...` URL synthesized by `message-attachment-to-display.ts` for stage attachments that carry inline base64 content and no `url`.
4. Inline `attachment.data` decoded via `base64ToBlobUrl(data, contentType)`.
5. `null` if no source is available ("not previewable").

Because images skip `fetch()`, `resolveImageCanvasContent` never returns `ErrorCanvasContent`. Load failures surface as an inline error state in the renderer instead (see "Rendering" below).

#### Rendering

Images are rendered by the `ImageContent` sub-component (`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx`). It renders `<img src={url} alt={fileName} className="max-h-full max-w-full object-contain" onError>` centered in the canvas body. When `onError` fires (network failure, HTTP 4xx/5xx, CORS), the component switches to a centered `<IconAlertTriangle>` + `loadErrorLabel` message — the same visual slot used by `UnsupportedCanvasContent`. The error state resets automatically when `url` changes (a `useEffect` keyed on `url` calls `setHasError(false)`).

---

### PDF rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolvePdfCanvasContent` when `contentType === 'application/pdf'` (MIME, checked first) or when the lowercased file extension is `pdf`. PDF routing runs before the generic `isTextPreviewable` branch.

#### Content resolution

`resolvePdfCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts` is `async` and resolves `url` via the shared `resolveAttachmentBlobUrl` helper (see "Shared content resolution helpers" below). A resolved `ErrorCanvasContent` is returned as-is; a resolved string is wrapped as `{ type: AttachmentContentType.Pdf, url }`; `undefined` returns `null`.

Precedence (via `resolveAttachmentBlobUrl`): local `attachment.file` (`URL.createObjectURL`) → `resolveDialUrl(attachment)` fetched via `fetchDialBlob` (LRU-cached; a non-OK response or network error yields `ErrorCanvasContent` instead) → `attachment.previewUrl` → inline base64 `attachment.data` decoded into a `Blob` (`type: attachment.contentType`) and turned into an object URL via `URL.createObjectURL`.

This covers stage attachments (e.g. from the DIAL Annotation API) that carry the PDF as inline base64 `data` with no `url` — `DocumentPreview` receives a `blob:` object URL and loads it the same way it would a remote URL. A DIAL-hosted PDF is fetched once at resolution time (to classify load/permission failures before rendering); `DocumentPreview`'s own `loadFileCb` then resolves that `blob:` URL from the in-memory blob store, so this does not add a second network round-trip.

Citation-preview PDFs (see "Citation preview" below) build their `PdfCanvasContent.url` directly from the annotation's source `attachment.url` without going through `resolveAttachmentBlobUrl` — a load failure for that path surfaces only inside `DocumentPreview` itself, not as `ErrorCanvasContent`. This is a known gap, not covered by this section.

#### Rendering

The `PdfContent` component (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx`) wraps `DocumentPreview` and adds a single floating collapsible thumbnails panel — the same FAB + overlay pattern on both desktop and mobile — closed by default.

**Layout** — root is `relative flex h-full overflow-hidden`:
- Once `totalPages > 0`, a `FabButton` (`@epam/ai-dial-ui-kit`) is absolutely positioned at `start-3 top-3` inside the relative root (a "bubble" pinned to the top-start corner, on every breakpoint) and acts as the trigger for a `Dropdown` (`@epam/ai-dial-ui-kit`) whose `renderOverlay` renders a `w-36` panel floating above the document — `placement="bottom-start"`, `matchReferenceWidth={false}`, controlled by `isThumbnailsOpen` (default `false`). The FAB icon swaps `IconMenu2` (burger, collapsed) ↔ `IconX` (expanded) — no visible title text — and its `aria-label`/`aria-expanded` reflect open/closed state via `labels.showThumbnailsLabel` / `labels.hideThumbnailsLabel` (defaults `'Show thumbnails'` / `'Hide thumbnails'`); `aria-controls` points at the thumbnails region's `id` while expanded, omitted while collapsed since the region is unmounted then, not merely hidden. Opening the panel does not resize or replace the document viewer — it stays full width underneath.
- **Viewer pane** (`min-w-0 flex-1 overflow-auto`) — contains `DocumentPreview`, always full width regardless of thumbnails-open state.

**Panel internal layout** — the `renderOverlay` content is a `flex flex-col` column with two children, not a single scrollable div, so the page navigator stays pinned above the scrolling thumbnail list:
1. A `shrink-0` header row holding the page-number `Input` (see "Page navigator" below).
2. The scrollable thumbnails region itself: `role="region"`, `id` from `useId()`, `aria-label={labels.thumbnailsLabel}`, classed `max-h-[70vh] overflow-y-auto overflow-x-hidden p-1 [scrollbar-gutter:stable]`. `PdfContent` owns this scroll container directly — `panelRef` points at this exact element and all scroll/resize tracking reads `panelRef.current` — deliberately not delegated to any ancestor established by `Dropdown` internally, since that would be a second, competing scroll container. `w-36` (144px) comfortably fits the library's fixed `120px`-wide `PageThumbnail` tile without horizontal overflow; `[scrollbar-gutter:stable]` reserves the native scrollbar's width up front so the left/right padding stays visually even whether or not the scrollbar is actually rendered.

**Page navigator** — an `Input` (`@epam/ai-dial-ui-kit`, `size={ElementSize.Small}`) pinned at the top of the panel, above the scrollable thumbnail list:
- `value` is `pageInputValue` (local string state, kept separate from `selectedPage` so the field can be freely edited/cleared before a valid page number is committed), `postfix` is `` `/ ${totalPages}` `` (static, non-editable total).
- Typing updates `pageInputValue` only. Committing — `Enter` (`onKeyDown`) or blur (`onBlur`) — calls `commitPageInput`, which parses the value; if it is an integer within `[1, totalPages]` it calls `handleSelectPage` (same path a thumbnail click uses — updates `selectedPage` and calls `viewerApiRef.current?.navigateToPage`), otherwise it resets the field back to the current `selectedPage`.
- A `useEffect` keyed on `[selectedPage]` re-syncs `pageInputValue` whenever `selectedPage` changes from elsewhere (thumbnail click, citation navigation), so the field always reflects the current page when not being actively edited.
- `aria-label` comes from `labels.pageNumberLabel` (default `'Page number'`).

**Thumbnail loading — eager first batch, then load-on-open/scroll:**
- As soon as `totalPages` resolves (document loaded), an effect requests a viewport-sized "eager" batch of thumbnails — `Math.ceil(panelHeight / itemHeight)` pages, capped at `totalPages` — regardless of whether the panel is open. `panelHeight`/`itemHeight` fall back to constants (`600` / `200` px) until the panel has been opened and measured once, so this eager batch loads in the background while the panel is still closed, and is instant on first open.
- The thumbnail list's DOM nodes (and the region that wraps them) only exist while the panel is open — the `Dropdown` overlay is conditionally rendered on `isThumbnailsOpen`, not merely hidden — so the `IntersectionObserver` that requests further pages (pages scrolled within 300 px of the viewport) naturally only fires once the user has opened the panel — satisfying "load thumbnails beyond the first batch only when clicked open."
- `thumbnails` state (`Map<number, string>`) and `requestedThumbnailPages` persist across open/close toggles — reopening the panel does not re-request or re-render already-loaded thumbnails.

**`selectedPage` state** — tracks which thumbnail is highlighted (selected):
- Initialised via a lazy `useState` initializer: finds the `InputHighlightData` entry whose `id` matches `selectedHighlightId` and returns its first `BBox.page`; falls back to `1` when no match is found.
- A `useEffect` keyed on `[selectedHighlightId, highlights]` updates `selectedPage` when the user opens a different citation in the same PDF (new `selectedHighlightId` prop on the already-mounted component).
- `PdfContent` is keyed by `content.url` in `AttachmentCanvas` — the component stays mounted across same-PDF citation changes, so there is no blink or document reload.
- A second `useEffect` keyed on `[selectedPage, totalPages, isThumbnailsOpen]` calls `scrollIntoView({ block: 'center', behavior: 'smooth' })` on the selected thumbnail's wrapper `div` (tracked in `thumbnailNodeRefs`) when that node exists, or `scrollTo` on `panelRef.current` otherwise — i.e. once the thumbnails panel has been opened and rendered.
- Clicking a thumbnail calls `handleSelectPage`, which sets `selectedPage` directly and calls `viewerApiRef.current?.navigateToPage(pageNum)`.

`DocumentPreview` props:

| Prop | Value |
|---|---|
| `fileUrl` | `content.url` — resolved URL or object URL |
| `loadFileCb` | `loadPdf` prop (optional); falls back to `fetchBlobFromUrl` from `libs/attachment-canvas/src/utils/download.ts` (fetches the URL, throws on non-OK status, returns `Blob`) |
| `highlights` | `content.highlights ?? []` — highlight regions; empty when no citation context |
| `selectedHighlightId` | `content.selectedHighlightId` — viewer scrolls to this highlight on load |
| `showOccurrences` | `false` — occurrence counter suppressed |
| `thumbnailPageNumbers` | pending (eagerly-requested or scroll-requested, not-yet-loaded) page numbers — drives thumbnail generation inside the library |
| `onTotalPagesChange` | sets `totalPages` state, which controls thumbnails-affordance visibility and drives the eager batch |
| `onThumbnailsLoaded` | merges newly loaded thumbnail URLs into `thumbnails` state (`Map<number, string>`) |
| `onViewerReady` | stores the `PdfViewerApi` reference used for programmatic page navigation |

`PdfContent`'s optional `labels` prop (`PdfContentLabels`: `thumbnailsLabel`, `showThumbnailsLabel`, `hideThumbnailsLabel`, `pageNumberLabel`) is threaded from `AttachmentCanvasLabels` (`pdfThumbnailsLabel`, `pdfShowThumbnailsLabel`, `pdfHideThumbnailsLabel`, `pdfPageNumberLabel`) through `AttachmentCanvasBodyLabels` — the app supplies these via `AttachmentCanvasI18nKeys.PdfThumbnailsLabel` / `PdfShowThumbnailsLabel` / `PdfHideThumbnailsLabel` / `PdfPageNumberLabel`, all with English defaults when omitted.

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

---

## Requirements

### Requirement: The canvas panel opens beside the conversation and closes on navigation

Activating an attachment SHALL open `AttachmentCanvas` at the right edge of the conversation layout, keyed by the `attachmentId` the caller supplies. The panel SHALL close whenever the URL `pathname` changes, and SHALL be mutually exclusive with both `ConversationSourcesPanel` and the conversation history panel — opening any one of the three closes the other two, synchronously, before any content is fetched.

#### Scenario: Activating an attachment opens the panel

- **WHEN** the user activates an attachment card from a message bubble, an input tray, or the sources panel
- **THEN** `openCanvas` is called with the resolved content, file name, and attachment key, and the panel renders open at the right edge

#### Scenario: Only the tile that opened the canvas reads as selected

- **GIVEN** two messages hold attachments with the same content-derived `id`
- **WHEN** one of them opens the canvas
- **THEN** only that message's tile renders selected, because the key carries the message index and each message strips its own prefix

#### Scenario: Navigating away closes the panel

- **WHEN** the `pathname` changes for a conversation switch, catalog navigation, or new chat
- **THEN** `closeCanvas()` runs and the panel is closed

#### Scenario: The panels never overlap

- **WHEN** the user opens the canvas while the sources panel or the history panel is open
- **THEN** the other panel closes immediately on click, before content resolution completes
- **AND** opening either of those panels afterwards closes the canvas

#### Scenario: The chat area keeps a minimum width

- **WHEN** the user drags the canvas resize handle on desktop
- **THEN** the width is clamped between 600 px and `usePanelMaxWidth()`, leaving at least 400 px of chat area
- **AND** on mobile the panel fills the viewport and is not resizable

### Requirement: The canvas is an accessible, always-available panel

`SidebarPanel` SHALL render with `role="complementary"` and the `ariaLabel` prop as its accessible name, SHALL be `aria-hidden` while closed, and SHALL expose every header control by keyboard with an `aria-label` supplied as a prop. All app-level strings SHALL come from `AttachmentCanvasI18nKeys`, with the lib carrying English defaults. The capability SHALL NOT be gated behind a feature flag.

#### Scenario: The panel is a named landmark

- **WHEN** the canvas is open
- **THEN** it exposes `role="complementary"` named by `ariaLabel`, and its close, download, and copy buttons are reachable by Tab with their own labels

#### Scenario: A closed panel is hidden from assistive tech

- **WHEN** the canvas is closed
- **THEN** the panel carries `aria-hidden="true"`

### Requirement: Content type routing resolves a typed payload at the app layer

`useOpenAttachmentCanvas` SHALL resolve a `DisplayAttachment` into a typed content payload before the lib renders anything, switching first on `attachment.type` and then, for files, running the reference-only PDF check, the no-type inline-data fallback, MIME routing, and extension routing in that order. Extension checks for `md`/`markdown`, `json`, `pdf`, and `html`/`htm` SHALL run before the generic `isTextPreviewable` branch, which routes to `resolveCodeCanvasContent`. Anything unmatched SHALL become `UnsupportedCanvasContent`.

#### Scenario: html extension routes to Html

- **WHEN** `openFileCanvas` is called with an attachment whose name ends in `.html`
- **THEN** `resolveHtmlCanvasContent` is called
- **AND** the canvas opens with `HtmlCanvasContent`

#### Scenario: ts extension routes to Code

- **WHEN** `openFileCanvas` is called with an attachment whose name ends in `.ts`
- **THEN** `resolveCodeCanvasContent` is called with `language: 'typescript'`
- **AND** the canvas opens with `CodeCanvasContent`

#### Scenario: A reference-only PDF chunk opens the referenced page

- **GIVEN** an attachment with no `url` and a `referenceUrl` such as `files/{bucket}/report.pdf#page=81`
- **WHEN** `openFileCanvas` runs
- **THEN** `referenceAttachmentToPdfCanvasContent` returns a `PdfCanvasContent` scrolled to page 81, and no further routing runs

#### Scenario: Inline data with no content type renders as text

- **GIVEN** an attachment whose `contentType` is the empty string and whose `data` is present
- **WHEN** `openFileCanvas` runs
- **THEN** `resolveTextCanvasContent` produces the content and the attachment does not fall through to `Unsupported`

### Requirement: Each content type has a dedicated renderer

`AttachmentCanvas` SHALL dispatch on `AttachmentContentType` to the renderer listed in the "Content renderers" table, and SHALL render `Json`, `Code`, and `Html` bodies inside a `dir="ltr"` container so code and tree layout stay left-to-right in an RTL app.

#### Scenario: Code content type uses CodeContent renderer

- **WHEN** `AttachmentCanvas` renders a `CodeCanvasContent`
- **THEN** a `CodeContent` component is mounted in the panel body

#### Scenario: Html content type uses HtmlContent renderer

- **WHEN** `AttachmentCanvas` renders an `HtmlCanvasContent`
- **THEN** an `HtmlContent` component is mounted in the panel body

### Requirement: Load failures are distinguished from unsupported previews

A failed fetch SHALL resolve to `ErrorCanvasContent` carrying `errorType: Forbidden` for HTTP `403` and `errorType: LoadFailed` otherwise, and every `resolveXCanvasContent` SHALL propagate it unchanged rather than wrapping it. `isDownloadable(content)` SHALL return `false` for a `Forbidden` error regardless of `url`, `true` for a `LoadFailed` error or an `Unsupported` payload when `url` is present, and `false` for `VisualizerCanvasContent`.

#### Scenario: A forbidden file offers no download

- **WHEN** the fetch for an attachment returns HTTP `403`
- **THEN** the body shows `forbiddenErrorLabel` and the header renders no download button, even though a `url` is known

#### Scenario: A failed load stays retryable

- **WHEN** the fetch fails with a network error or a non-`403` status and a `url` is known
- **THEN** the body shows `loadErrorLabel` and the download button is still offered

#### Scenario: Image failures surface in the renderer, not as error content

- **WHEN** an image fails to load
- **THEN** `resolveImageCanvasContent` still returns `ImageCanvasContent` and `ImageContent`'s `onError` swaps in the inline error message

### Requirement: `AttachmentContentType.Visualizer` variant

`libs/attachment-canvas/src/types/attachment-canvas.ts` SHALL add a new enum member `AttachmentContentType.Visualizer`.

`libs/attachment-canvas/src/models/attachment-canvas.ts` SHALL add a new member to the `AttachmentCanvasContent` discriminated union:

```ts
interface VisualizerCanvasContent {
  type: AttachmentContentType.Visualizer;
  url: string;                              // iframe src, from the registry entry's `url`
  mimeType: string;                         // the attachment's own MIME (NOT the entry's raw
                                            // `contentType`, which may be a comma-separated list)
  data: unknown;                            // opaque attachment payload consumed by the visualizer
  layout: CustomVisualizerDataLayout;       // themeId, width, height, mobileHeight
  visualizerName: string;                   // postMessage type prefix — MUST be the registry
                                            // entry's `title`; the iframe app is constructed
                                            // with the identical string or nothing is received
  requestTimeout?: number;                  // from the registry entry; bounds send(), default
                                            // 10000ms. Does NOT bound the handshake.
}
```

`isDownloadable(content)` SHALL return `false` for a `VisualizerCanvasContent` value.

**RTL impact:** none directly; canvas panel chrome already handles direction.

**i18n impact:** none; visualizer chrome carries no lib-side user-visible strings.

#### Scenario: Visualizer content is not downloadable

- **WHEN** the canvas is opened with a `VisualizerCanvasContent` and `onDownload` is provided
- **THEN** the download button in the canvas header is not rendered

#### Scenario: Panel opens with visualizer content

- **WHEN** `openCanvas` is called with a `VisualizerCanvasContent` and `fileName`
- **THEN** `AttachmentCanvasContext.content` equals the passed content
- **AND** `AttachmentCanvasContainer` re-renders with the panel open and the visualizer renderer inside

### Requirement: `VisualizerCanvasRenderer` component

`libs/attachment-canvas/src/components/VisualizerCanvasRenderer/VisualizerCanvasRenderer.tsx` SHALL render an iframe host and drive the visualizer handshake and data delivery via the published npm package `@epam/ai-dial-visualizer-connector` (and `@epam/ai-dial-shared` for the request enum). Behaviour:

- On mount, create a `VisualizerConnector` bound to the container element, passing `domain: content.url`, `hostDomain: window.location.origin` (required by the published options type; unused at runtime in the current package), `visualizerName: content.visualizerName`, and `requestTimeout: content.requestTimeout`.
- Await `.ready()` and then call `.send(VisualizerConnectorRequests.sendVisualizeData, { mimeType: content.mimeType, visualizerData: { layout: content.layout, ...content.data } })`, where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-shared` (camelCase member; wire value `SEND_VISUALIZE_DATA`).
- On unmount, call `connector.destroy()` exactly once for that instance.
- Display a loading state while `.ready()` is pending. Because `.ready()` never times out (see the `custom-visualizers` capability), a visualizer that never completes the handshake leaves the body in this loading state indefinitely — this is intended. Display an error state if the `SEND_VISUALIZE_DATA` `send()` rejects (its own timeout) or if `.ready()` rejects due to `destroy()`.
- The component SHALL keep the connector instance stable across parent re-renders that do not change `url` / `visualizerName` / `requestTimeout`, so those re-renders do not tear down the iframe.

The component MUST NOT read from any app-level context (auth, theme, i18n, feature flags) — all data required for the visualizer is passed in through `VisualizerCanvasContent`.

#### Scenario: connector is destroyed on unmount

- **WHEN** the `VisualizerCanvasRenderer` unmounts
- **THEN** `VisualizerConnector.destroy()` is called
- **AND** the iframe element is removed from the DOM

#### Scenario: SEND_VISUALIZE_DATA is dispatched after READY_TO_INTERACT

- **WHEN** the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the renderer calls `connector.send` with the published enum member whose wire value is `SEND_VISUALIZE_DATA` exactly once
- **AND** the payload's `layout` equals `content.layout`

#### Scenario: send failure surfaces error state

- **WHEN** the `SEND_VISUALIZE_DATA` `send()` promise rejects (no `/RESPONSE` within `requestTimeout`)
- **THEN** the renderer displays an error state
- **AND** the canvas remains closable via the header's close button

#### Scenario: incomplete handshake stays in the loading state

- **WHEN** the iframe mounts but never posts `READY_TO_INTERACT`
- **THEN** the renderer keeps showing the loading state and does not show an error
- **AND** the canvas remains closable via the header's close button

### Requirement: `AttachmentCanvas` switch handles Visualizer variant

`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx` SHALL extend its switch over `AttachmentContentType` with a `case AttachmentContentType.Visualizer` branch that renders `<VisualizerCanvasRenderer content={content} />` inside the panel body.

The panel chrome (header, close button, resize handle, keyboard/ARIA behaviour) SHALL be identical to the chrome used for other content types.

**Feature flag:** none. The variant is reachable only when the app builds a `VisualizerCanvasContent` from a populated registry.

#### Scenario: rendering switch dispatches to the visualizer branch

- **WHEN** `AttachmentCanvas` is rendered with a `VisualizerCanvasContent`
- **THEN** the panel body contains a mounted `VisualizerCanvasRenderer`
- **AND** the panel header renders the `fileName` as usual

### Requirement: `useOpenAttachmentCanvas` dispatches to the visualizer branch before content-type handling

`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`'s internal `openFileCanvas` SHALL check the attachment's `contentType` against the `CustomVisualizer[]` registry (via `useCustomVisualizers()` and a case-insensitive `findVisualizerForMime` lookup) as the FIRST case in its `switch (contentType)` block — evaluated before the existing `MIMEType.PDF`, `MIMEType.Markdown`, and `MIMEType.JSON` cases described above.

When a match is found:

- The hook fetches the attachment payload using the same file-content helper already used for text/JSON attachments.
- On success, it builds a `VisualizerCanvasContent`: `url` from the registry entry, `mimeType` from the attachment's own `contentType`, `data` from the fetched payload, `layout` with `width`/`height`/`mobileHeight` from the registry entry plus `themeId` from theme context, `visualizerName` from the registry entry's `title`, and `requestTimeout` from the registry entry. It returns this for `openCanvas`.
- On payload-fetch failure, the hook falls through to the existing switch/extension/`Unsupported` handling (unchanged behaviour).

When the registry is empty or no entry matches, `openFileCanvas` behaves exactly as it did before this addition.

`apps/chat/src/hooks/attachment/useAttachmentAction.ts` is NOT modified by this addition. It only runs as a fallback when `openAttachmentCanvas` returns `false` (see "Open triggers" above), and a matched visualizer MIME always causes `openAttachmentCanvas` to return `true` — so `useAttachmentAction` would never observe a visualizer-eligible attachment.

**Feature flag:** none. The `CUSTOM_VISUALIZERS` env is the effective gate.

**RTL impact:** none. Canvas chrome already handles direction.

**i18n impact:** none new. Existing labels are reused.

#### Scenario: MIME matches a visualizer registry entry from a message bubble click

- **WHEN** `handleMessageAttachmentClick` (`ConversationView.tsx`) is invoked for an attachment whose `contentType` matches a `customVisualizers` entry
- **THEN** `openAttachmentCanvas` resolves a `VisualizerCanvasContent` and calls `openCanvas` with it
- **AND** the panel opens with the visualizer renderer, not the PDF/Markdown/JSON/Unsupported branch

#### Scenario: MIME matches but payload fetch fails — falls back to existing handling

- **WHEN** the registry contains a matching entry but fetching the attachment payload rejects
- **THEN** `openFileCanvas` falls through to the existing `contentType`/extension switch for that attachment

#### Scenario: Registry is empty — behaviour unchanged

- **WHEN** the `customVisualizers` registry is `[]`
- **THEN** `openFileCanvas` behaves exactly as it did before this addition

#### Scenario: MIME does not match any registry entry

- **WHEN** the registry contains only `contentType: 'application/x-my-viz'` and the attachment's `contentType` is `'application/pdf'`
- **THEN** the visualizer branch does not fire; the existing `MIMEType.PDF` case handles the attachment
