## Slice 1 — Add `Markdown` and `Json` content types to `libs/attachment-canvas`

**Spec:** `canvas-markdown`, `canvas-json`

**Files:**
- `libs/attachment-canvas/src/types/attachment-canvas.ts`
- `libs/attachment-canvas/src/models/attachment-canvas.ts`
- `libs/attachment-canvas/src/index.ts`
- `libs/attachment-canvas/package.json`

**Tasks:**
1. Add `Markdown = 'markdown'` and `Json = 'json'` to `AttachmentContentType`.
2. Add `MarkdownCanvasContent` and `JsonCanvasContent` interfaces to the models file; extend the `AttachmentCanvasContent` union.
3. Export the two new types from `src/index.ts`.
4. Add `@epam/ai-dial-chat-shared` and `react-json-view-lite` to `package.json` `peerDependencies`.
5. Architecture guard: verify `libs/attachment-canvas` still contains no imports of `@epam/chat-api-client`, app context, server-api, routes, env vars, or DIAL file URL logic.

**Verification:** `npm exec nx typecheck attachment-canvas && npm exec nx lint attachment-canvas`

---

## Slice 2 — Render Markdown in `AttachmentCanvas`

**Spec:** `canvas-markdown`

**Files:**
- `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx`
- `libs/attachment-canvas/src/components/AttachmentCanvas/tests/AttachmentCanvas.spec.tsx`

**Tasks:**
1. Import `MarkdownRenderer` from `@epam/ai-dial-chat-shared`.
2. Add a `Markdown` case to the content switch: render `<MarkdownRenderer content={content.text} isStreaming={false} />` inside the existing scrollable body wrapper.
3. Wire the `codeBlockTheme` prop through `AttachmentCanvasProps` → `AttachmentCanvasContainerProps` → `AttachmentCanvasContainer` so the app can pass the current theme.
4. Add test: `AttachmentCanvas` renders `MarkdownRenderer` for `AttachmentContentType.Markdown` content.

**Verification:** `npm exec nx test attachment-canvas && npm exec nx typecheck attachment-canvas`

---

## Slice 3 — Render JSON tree in `AttachmentCanvas`

**Spec:** `canvas-json`

**Files:**
- `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx`
- `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.module.scss`
- `libs/attachment-canvas/src/components/AttachmentCanvas/tests/AttachmentCanvas.spec.tsx`

**Tasks:**
1. Import `JsonView` from `react-json-view-lite`; import the default stylesheet.
2. Add a `Json` case: render `<div dir="ltr" className="h-full overflow-auto p-4"><JsonView data={content.value} /></div>`.
3. Add CSS variable overrides in `AttachmentCanvas.module.scss` so the tree matches the panel's color scheme (light/dark tokens).
4. Add test: `AttachmentCanvas` renders the JSON tree viewer for `AttachmentContentType.Json` content.

**Verification:** `npm exec nx test attachment-canvas && npm exec nx typecheck attachment-canvas`

---

## Slice 4 — App-level content resolvers for Markdown and JSON

**Spec:** `canvas-markdown`, `canvas-json`

**Files:**
- `apps/chat/src/utils/attachment-canvas.ts`
- `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`

**Tasks:**
1. Add `resolveMarkdownCanvasContent` — fetches file text, returns `MarkdownCanvasContent`; returns `null` on fetch failure or missing URL.
2. Add `resolveJsonCanvasContent` — fetches file text, attempts `JSON.parse`; returns `JsonCanvasContent` on success, `PlainTextCanvasContent` on `SyntaxError`, `null` on fetch failure.
3. Update `useOpenAttachmentCanvas`:
   - Route `md` / `markdown` extensions to `resolveMarkdownCanvasContent` (before `isTextPreviewable`).
   - Route `json` extension to `resolveJsonCanvasContent` (before `isTextPreviewable`).
   - All other text-previewable extensions continue to use `resolveTextCanvasContent`.

**Verification:** `npm exec nx typecheck chat && npm exec nx lint chat`

---

## Slice 5 — Unit tests for new content resolvers

**Spec:** `canvas-markdown`, `canvas-json`

**Files:**
- `apps/chat/src/utils/tests/attachment-canvas.spec.ts` (new or extended)
- `apps/chat/src/hooks/attachment/tests/useOpenAttachmentCanvas.spec.ts` (new or extended)

**Tasks:**
1. `resolveMarkdownCanvasContent`: success fetch → `MarkdownCanvasContent`; non-OK response → `null`; local file → `MarkdownCanvasContent`.
2. `resolveJsonCanvasContent`: valid JSON → `JsonCanvasContent`; malformed JSON → `PlainTextCanvasContent`; non-OK response → `null`; local file (valid JSON) → `JsonCanvasContent`.
3. `useOpenAttachmentCanvas`: `.md` attachment routes to markdown resolver; `.json` attachment routes to JSON resolver; `.jsonl` attachment routes to plain-text resolver (not JSON).

**Verification:** `npm exec nx test chat`

---

## Slice 6 — Wire `codeBlockTheme` through the container

**Spec:** `canvas-markdown`

**Files:**
- `libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx`
- `apps/chat/src/app/app.tsx`

**Tasks:**
1. Add `codeBlockTheme?: CodeBlockTheme` to `AttachmentCanvasContainerProps`; forward to `AttachmentCanvas`.
2. In `app.tsx`, pass the current theme's code block theme value to `AttachmentCanvasContainer`.

**Verification:** `npm exec nx typecheck attachment-canvas && npm exec nx typecheck chat`

---

## Slice 7 — RTL check

**Spec:** `canvas-panel`, `canvas-json`

**Tasks:**
1. Verify `MarkdownRenderer` renders correctly under `dir="rtl"` on `<html>` — logical classes (headings, lists, blockquote border) should mirror correctly.
2. Confirm the JSON tree container renders with `dir="ltr"` in both LTR and RTL modes.

**Verification:** Manual RTL smoke test (set `document.documentElement.dir = 'rtl'`) in the running app; no automated test required.

---

## Slice 8 — Thread `onAttachmentClick` through conversation-stages

**Problem:** Stage attachments do nothing when clicked — `onAttachmentClick` is not in `StagesPanelProps` / `CollapsedGroupProps` and is never wired to `AttachmentTray`.

**Files:**
- `libs/conversation-stages/src/models/stages-props.ts`
- `libs/conversation-stages/src/models/collapsed-group.ts`
- `libs/conversation-stages/src/components/StagesPanel/StagesPanel.tsx`
- `libs/conversation-stages/src/components/StageItem/StageItem.tsx`
- `libs/conversation-stages/src/components/CollapsedGroup/CollapsedGroup.tsx`
- `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`

**Tasks:**
1. Add `onAttachmentClick?: (attachment: DisplayAttachment) => void` to `StagesPanelProps` and `CollapsedGroupProps`.
2. Thread the prop: `CollapsedGroup` → `StagesPanel` → `StageItem` → `AttachmentTray`.
3. Pass `handleAttachmentClick` to `<CollapsedGroup>` in `ConversationMessageItem`.

**Verification:** `npm exec nx test conversation-stages && npm exec nx typecheck conversation-stages && npm exec nx typecheck chat`

---

## Slice 9 — MIME-type routing and inline `data` support for stage attachments

**Problem:** Stage attachments carry `type: "text/markdown"` (MIME) and inline `data`, but:
- `DisplayAttachment` has no `data` field, so inline content is lost in `toDisplayAttachment`.
- The title (e.g. `"[1] report.pdf"`) contains `.pdf` → extension routing gives "unsupported".
- Resolvers only handle `url`-based or `file`-based content, not inline `data`.

**Files:**
- `libs/chat-shared/src/models/chat.ts`
- `libs/conversation-stages/src/utils/to-display-attachment.ts`
- `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`
- `apps/chat/src/utils/attachment-canvas.ts`

**Tasks:**
1. Add `data?: string` to `DisplayAttachment` (inline text content from API).
2. Map `attachment.data` in `toDisplayAttachment`.
3. In `useOpenAttachmentCanvas`, add MIME-type routing before extension routing: `text/markdown` → `resolveMarkdownCanvasContent`; `application/json` → `resolveJsonCanvasContent`.
4. Add inline `data` path to `resolveMarkdownCanvasContent` and `resolveJsonCanvasContent`.

**Verification:** `npm exec nx test chat && npm exec nx test conversation-stages && npm exec nx typecheck chat`

---

## Slice 10 — "Copy as Markdown" button in the canvas panel

**Spec:** `canvas-markdown`

**Files:**
- `libs/attachment-canvas/src/models/attachment-canvas.ts`
- `libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx`
- `libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx`
- `apps/chat/src/constants/translation-keys.ts`
- `apps/chat/src/i18n/locales/en.json`
- `apps/chat/src/app/app.tsx`

**Tasks:**
1. Add `onCopyMarkdown?: () => void`, `copyMarkdownLabel?: string`, `copiedMarkdownLabel?: string` to `AttachmentCanvasProps`.
2. In `AttachmentCanvas`: add `isCopiedMarkdown` toggle state (2 s reset); render `IconMarkdown`/`IconCheck` button in `rightActions` to the left of the download button when `content.type === Markdown && onCopyMarkdown`.
3. Add `copyMarkdownLabel?: string` and `copiedMarkdownLabel?: string` to `AttachmentCanvasContainerProps`; wire `handleCopyMarkdown` via `copyToClipboard(content.text)` for `Markdown` content type.
4. Add `CopyAsMarkdown` and `Copied` keys to `AttachmentCanvasI18nKeys` in `translation-keys.ts`; add translations to `en.json`.
5. Pass `copyMarkdownLabel` and `copiedMarkdownLabel` to `<AttachmentCanvasContainer>` in `app.tsx`.

**Verification:** `npm exec nx typecheck attachment-canvas && npm exec nx lint attachment-canvas && npm exec nx typecheck chat && npm exec nx lint chat`

---

## Final verification

```
npm exec nx affected --target=typecheck --base=origin/development-1.0
npm exec nx affected --target=lint --base=origin/development-1.0
npm exec nx affected --target=test --base=origin/development-1.0
```
