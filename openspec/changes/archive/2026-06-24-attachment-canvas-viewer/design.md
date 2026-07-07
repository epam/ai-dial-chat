## Context

The attachment canvas is a right-side `SidebarPanel` that previews file content without navigating away from the conversation. The architecture has two distinct layers:

- **`libs/attachment-canvas`** — host-agnostic: the panel component, content type enum, context, and container. Has no knowledge of DIAL file download URLs, auth, routing, or app config.
- **`apps/chat`** — app-level: URL resolution (`apps/chat/src/utils/attachment-canvas.ts`), dispatch hook (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`), `AttachmentCanvasProvider` mount in `apps/chat/src/main.tsx`, and i18n wiring.

## Goals / Non-Goals

**Goals:**
- Document the existing canvas architecture: panel, image, and plain-text formats.
- Design the Markdown and JSON format extensions.
- Define the lib isolation boundary for the new dependencies (`MarkdownRenderer`, `react-json-view-lite`).

**Non-Goals:**
- Citation-aware highlighting (bounding-box overlays, character-range selection) — the canvas currently receives a `DisplayAttachment` from `annotationToDisplayAttachment`, which drops all `Annotation.body` data; this richer mode is a future capability.
- Backend changes — all content is fetched client-side.

## Decisions

### D1 — Discriminated union for content types

`AttachmentContentType` (enum) + `AttachmentCanvasContent` (discriminated union) in `libs/attachment-canvas/src/types/` and `src/models/`. `AttachmentCanvas` switches on `content.type` to select the renderer. Adding a format = new enum member + payload interface + case in the switch. TypeScript enforces exhaustiveness.

*Alternative considered:* render-function prop. Rejected — exposes an unstable extension API and loses compile-time exhaustiveness.

### D2 — Markdown via peer dep on `@epam/ai-dial-chat-shared`

`MarkdownRenderer` in `libs/chat-shared` handles GFM, code blocks (with copy button and syntax highlighting), tables, blockquotes, and RTL-aware logical CSS properties. Reusing it avoids duplicating a markdown parser inside the canvas lib.

`@epam/ai-dial-chat-shared` contains no app-owned knowledge, so the peer dependency satisfies the lib isolation rule.

The canvas passes `content.text` (raw markdown string) to `MarkdownRenderer` with no `classNames` overrides and no `markdownComponents` customisation — neutral defaults, not bubble-matched typography. `isStreaming` is always `false` in the canvas.

### D3 — JSON viewer via `react-json-view-lite`

`react-json-view-lite` is lightweight (~15 kB gzipped), has no non-React peer dependencies, and supports expand/collapse of nested objects and arrays. The lib receives `content.value` (already-parsed `unknown`), not the raw string — the lib never calls `JSON.parse` and is not responsible for error handling.

App-level content resolution (`resolveJsonCanvasContent`):
1. Fetch raw text from the DIAL file URL.
2. Attempt `JSON.parse`.
3. On success: return `{ type: AttachmentContentType.Json, value: parsed }`.
4. On `SyntaxError`: return `{ type: AttachmentContentType.PlainText, text: rawText }` — graceful degradation; the user still sees the file content.

### D4 — JSON only (not JSONL)

Only `.json` gets the tree viewer. `.jsonl` and `.ndjson` are multi-document formats that `JSON.parse` cannot handle; they fall through to `resolveTextCanvasContent` and render as plain text. This is the correct path because they are already in `TEXT_EXTENSIONS`.

### D5 — Format routing by file extension

`useOpenAttachmentCanvas` inspects the lowercased extension and routes to the appropriate resolver before falling through to the existing plain-text path:

```
md / markdown           → resolveMarkdownCanvasContent  → MarkdownCanvasContent
json                    → resolveJsonCanvasContent       → JsonCanvasContent (or PlainText on parse failure)
image/*                 → resolveImageCanvasContent      → ImageCanvasContent
other text-previewable  → resolveTextCanvasContent       → PlainTextCanvasContent
everything else         → createUnsupportedCanvasContent → UnsupportedCanvasContent
```

The extension check for `md`/`markdown` and `json` must occur *before* the generic `isTextPreviewable` branch, since those extensions are already in `TEXT_EXTENSIONS`.

### D6 — Library isolation boundary

`libs/attachment-canvas` must not contain:
- DIAL Core file download URLs or `resolveDialFileDownloadUrl`
- Auth / CSRF tokens
- React Router / pathname
- App-level feature flags
- `@epam/chat-api-client` imports

All of these live in the app layer. The lib receives a fully-resolved `AttachmentCanvasContent` payload via `openCanvas(content, fileName)`.

### D7 — Both side panels coexist

`ConversationSourcesPanel` and `AttachmentCanvasContainer` are both mounted in `app.tsx` and can be open simultaneously. No mutual exclusion is required; the user manages width by dragging either panel. No state coordination is needed.

### D8 — Auto-close on navigation

`app.tsx` has a `useEffect` that calls `closeCanvas()` on every `pathname` change, covering conversation switches, catalog navigation, and new-chat navigation.

### D9 — JSON tree direction

`react-json-view-lite` uses physical CSS properties. The JSON tree container in `AttachmentCanvas` must carry `dir="ltr"` to prevent layout corruption in RTL mode. JSON key–value structure has no intrinsic text direction, so always-LTR is correct.

## Risks / Trade-offs

- **`react-json-view-lite` bundle** — ~15 kB gzipped; only loaded on conversation routes and only rendered for `.json` files. Acceptable.
- **Malformed JSON fallback** — plain-text degradation means the user always sees the file content.
- **Citation highlights not carried** — `annotationToDisplayAttachment` strips `Annotation.body` (quote, selectors, bboxes). The canvas shows the full backing file with no highlight overlay. A future "citation-aware canvas" mode would need to receive the full `Annotation` and implement document-level highlighting.
- **`MarkdownRenderer` neutrally styled** — no bubble typography overrides are applied. Headers render at browser default sizes unless the panel's parent provides a base font. This should be verified against the design.
