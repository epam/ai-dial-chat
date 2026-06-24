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
| `ConversationSourcesPanel` | `ConversationSourcesPanel.tsx` → `handleAttachmentClick` | Open canvas if previewable (closes source panel), fall back to download if `openAttachmentCanvas` returns `false` |

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

`useOpenAttachmentCanvas` maps a `DisplayAttachment` to a content payload. MIME-type routing runs first (for stage attachments that carry a `contentType` but no file extension), followed by extension-based routing (lowercased):

| MIME type / Extension(s) | Resolver | Content type returned |
|---|---|---|
| `text/markdown` MIME | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `application/json` MIME | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` |
| `md`, `markdown` extension | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `json` extension | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` (parse failure) |
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

### Citation preview

When a user clicks "Preview" in a `CitationDropdown`, `annotationToDisplayAttachment` converts the annotation's backing `AttachmentResource` to a `DisplayAttachment`. The canvas opens with the full source file. The `Annotation.body` fields (`quote`, `selector`, `configuration`) are **not** carried through; no highlighted region is shown.

A future "citation-aware" mode would pass the full `Annotation` to the canvas and render document-level highlights. Out of scope for this iteration.
