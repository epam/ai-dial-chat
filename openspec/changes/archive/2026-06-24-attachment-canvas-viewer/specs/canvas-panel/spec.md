## Capability: canvas-panel

### Overview

The `AttachmentCanvas` side panel opens to the right of the main conversation area when a user activates an attachment. It renders file content in a resizable, closeable panel that stays alongside the conversation.

### Open triggers

| Surface | Where in the codebase | Behavior |
|---|---|---|
| `MessageBubble` (user message) | `ConversationView.tsx` → `handleMessageAttachmentClick` | Open canvas |
| `MessageBubble` (assistant message) | `ConversationView.tsx` → `handleMessageAttachmentClick` | Open canvas |
| `CollapsedGroup` stage attachments | `ConversationMessageItem.tsx` via `onAttachmentClick` | Open canvas |
| `ConversationInput` tray (new message) | `ConversationRoute.tsx` → `handleAttachmentClick` | Open canvas |
| `EditMessageInput` tray | `ConversationView.tsx` → `handleInputAttachmentClick` | Open canvas |
| `ConversationSourcesPanel` | `ConversationSourcesPanel.tsx` → `handleAttachmentClick` | Open canvas if previewable, fall back to download if `openAttachmentCanvas` returns `false` |

### Open behavior

1. User activates an attachment card.
2. `useOpenAttachmentCanvas` (app hook at `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) resolves content from the `DisplayAttachment` (fetching file bytes if needed).
3. Hook calls `openCanvas(content, fileName)` from `useAttachmentCanvas()`.
4. `AttachmentCanvasContext` updates `isOpen = true`, `content`, and `fileName`.
5. `AttachmentCanvasContainer` (rendered in `app.tsx`) re-renders the panel open.

### Auto-close

The canvas closes when the URL `pathname` changes (conversation switch, catalog navigation, new chat). Implemented via a `useEffect` in `apps/chat/src/app/app.tsx` that calls `closeCanvas()` on every `pathname` change.

### Panel chrome

- **Position**: right edge of the conversation layout (`apps/chat/src/app/app.tsx`). Always on the physical right regardless of text direction — a viewer panel is not a directional element.
- **Header**: file name (truncated) on the start side; download icon button + close icon button on the end side.
- **Download button**: shown only when `onDownload` is provided **and** `content.type !== Unsupported`.
- **Close button**: calls `onClose` (`closeCanvas`).
- **Resizability**: enabled on desktop, disabled on mobile (`isMobile` prop from `useIsMobile()`).
- **Width defaults**: 560 px default, 320 px min, 960 px max. Width is not persisted between sessions.
- **Both panels**: `ConversationSourcesPanel` and `AttachmentCanvas` may be open simultaneously.

### Content type routing

`useOpenAttachmentCanvas` maps a `DisplayAttachment` to a content payload by extension (lowercased):

| Extension(s) | Resolver | Content type returned |
|---|---|---|
| `md`, `markdown` | `resolveMarkdownCanvasContent` | `MarkdownCanvasContent` |
| `json` | `resolveJsonCanvasContent` | `JsonCanvasContent` or `PlainTextCanvasContent` (parse failure) |
| `image/*` MIME | `resolveImageCanvasContent` | `ImageCanvasContent` |
| Other text-previewable (see `TEXT_EXTENSIONS`) | `resolveTextCanvasContent` | `PlainTextCanvasContent` |
| Everything else | `createUnsupportedCanvasContent` | `UnsupportedCanvasContent` |

Extension checks for `md`/`markdown` and `json` run *before* the generic `isTextPreviewable` branch.

### Content renderers

| `AttachmentContentType` | Payload field | Renderer |
|---|---|---|
| `Image` | `url: string` | `<img>` centered, `max-h-full max-w-full object-contain` |
| `PlainText` | `text: string` | `<pre>` with `whitespace-pre-wrap break-words` |
| `Markdown` | `text: string` | `MarkdownRenderer` from `@epam/ai-dial-chat-shared`, neutral defaults |
| `Json` | `value: unknown` | `react-json-view-lite` `JsonView`, container has `dir="ltr"` |
| `Unsupported` | — | Centered "Preview not supported" message |

### i18n

All app-level strings are in `AttachmentCanvasI18nKeys` (`apps/chat/src/constants/translation-keys.ts`):

| Key | en.json value |
|---|---|
| `AriaLabel` | `"Attachment preview"` |
| `CloseLabel` | `"Close attachment preview"` |
| `DownloadLabel` | `"Download attachment"` |
| `UnsupportedLabel` | `"Preview is not supported for this file"` |

Lib-level string props (`closeLabel`, `downloadLabel`, `unsupportedLabel`, `ariaLabel`) use English defaults and are overridden by the app via `AttachmentCanvasContainer`.

### Accessibility

- `SidebarPanel` renders with `role="complementary"` and `aria-label` from the `ariaLabel` prop.
- `aria-hidden="true"` is set on the panel when closed.
- Close and download buttons carry `aria-label` strings passed as props.
- Keyboard: close button and download button are reachable via Tab.

### RTL

- The panel is physically right-anchored. No logical-property flip is needed for the chrome.
- Header content (file name and action buttons) uses `start`/`end` layout — no physical direction classes.
- `MarkdownRenderer` uses logical CSS properties internally; no extra canvas-level RTL handling needed.
- The JSON tree container has `dir="ltr"` — see `canvas-json` spec.

### Feature flag

None. The canvas is always available to authenticated users.

### Citation preview (current behavior)

When a user clicks "Preview" in a `CitationDropdown`, `annotationToDisplayAttachment` converts the annotation's backing `AttachmentResource` to a `DisplayAttachment`. The canvas then opens with the full source file. The `Annotation.body` fields — `quote`, `selector`, and `configuration` (which may contain highlight bounding boxes) — are **not** carried through; the canvas shows the entire file with no highlighted region.

A future "citation-aware" mode would pass the full `Annotation` to the canvas and render document-level highlights. That is out of scope for this iteration.
