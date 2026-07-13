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
- **Download button**: shown only when `onDownload` is provided **and** `content.type !== Unsupported`.
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

`useOpenAttachmentCanvas` maps a `DisplayAttachment` to a content payload. Before any MIME-type or extension routing, `openFileCanvas` checks whether the attachment is reference-only (`attachment.url == null && attachment.referenceUrl != null` — a RAG/search-grounding chunk). When true, it calls `referenceAttachmentToPdfCanvasContent({ type: attachment.contentType, url: attachment.referenceUrl, title: attachment.name })`; if that returns a non-`null` `PdfCanvasContent` (the `referenceUrl` targets a `.pdf`, optionally with a `#page=N` fragment), the canvas opens with it immediately and no further routing runs. If it returns `null`, routing falls through to the table below unchanged — this applies uniformly to `CollapsedGroup` stage attachments and the plain attachment tray, so a reference-only PDF-page chunk (e.g. `reference_url: 'files/{bucket}/report.pdf#page=81'`) opens the actual referenced PDF at the referenced page instead of rendering its own `data`/`contentType` as Markdown or plain text. Otherwise, MIME-type routing runs first (for stage attachments that carry a `contentType` but no file extension), followed by extension-based routing (lowercased):

| MIME type / Extension(s) | Resolver | Content type returned |
|---|---|---|
| Reference-only, PDF-page-detectable `referenceUrl` | `referenceAttachmentToPdfCanvasContent` | `PdfCanvasContent` (scrolled to the referenced page when present) |
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

#### Content renderers

| `AttachmentContentType` | Payload field | Renderer |
|---|---|---|
| `Image` | `url: string` | `<img>` centered, `max-h-full max-w-full object-contain` |
| `PlainText` | `text: string` | `<pre>` with `whitespace-pre-wrap break-words` |
| `Markdown` | `text: string` | `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, neutral defaults |
| `Json` | `value: unknown` | `react-json-view-lite` `JsonView`, container has `dir="ltr"` |
| `Pdf` | `url: string; highlights?: InputHighlightData[]; selectedHighlightId?: string` | `PdfContent` (thumbnail sidebar + `DocumentPreview` from `@epam/ai-dial-react-pdf-highlighter`) |
| `Unsupported` | — | Centered "Preview not supported" message |

---

### Markdown rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolveMarkdownCanvasContent` when `contentType === 'text/markdown'` (MIME, checked first) or when the lowercased file extension is `md` or `markdown`.

#### Content resolution

`resolveMarkdownCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts`:

1. If `attachment.data != null`: return `{ type: AttachmentContentType.Markdown, text: attachment.data }` immediately (inline content from stage attachments).
2. Resolve the download URL via `resolveDialUrl(attachment)`. If `null`, return `null`.
3. `fetch` the resolved URL. If not OK, return `null`.
4. Return `{ type: AttachmentContentType.Markdown, text: await response.text() }`.

For locally-attached files (`'file' in attachment && attachment.file.size > 0`): read text directly from `attachment.file.text()`.

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

1. If `attachment.data != null`: apply the parse/fallback logic directly on `attachment.data`.
2. Resolve the download URL. If `null`, return `null`.
3. `fetch` the URL. If not OK, return `null`.
4. `const rawText = await response.text()`.
5. Attempt `JSON.parse(rawText)`.
   - On success: return `{ type: AttachmentContentType.Json, value: parsed }`.
   - On `SyntaxError`: return `{ type: AttachmentContentType.PlainText, text: rawText }` — graceful degradation.

For locally-attached files: read text from `attachment.file.text()`, then apply the same parse/fallback logic.

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

`DisplayAttachment.data?: string` carries this inline content through `toDisplayAttachment` to the canvas resolvers.

---

### PDF rendering

#### Trigger

`useOpenAttachmentCanvas` routes to `resolvePdfCanvasContent` when `contentType === 'application/pdf'` (MIME, checked first) or when the lowercased file extension is `pdf`. PDF routing runs before the generic `isTextPreviewable` branch.

#### Content resolution

`resolvePdfCanvasContent` in `apps/chat/src/utils/attachment-canvas.ts`:

1. If the attachment is a local file (`'file' in attachment` and `attachment.file.size > 0`): return `{ type: AttachmentContentType.Pdf, url: URL.createObjectURL(attachment.file) }`.
2. Resolve the download URL via `resolveDialUrl(attachment)`. If `null`, return `null`.
3. Return `{ type: AttachmentContentType.Pdf, url }`.

No server fetch is performed at resolution time; `DocumentPreview` handles file loading internally.

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
