## Context

The Skill Editor is split across an app-owned page and a host-agnostic library:

- `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` owns mode (`isEditMode` from `?id=`), the in-memory supporting-file bytes (`filesContentRef: Map<string, Uint8Array>`), the file tree (`files: SkillFileTreeNode[]`), upload/remove/validate `fileActions`, and the SKILL.md form values. It currently passes none of `selectedPath`/`onSelectedPathChange` to the lib — selection is fully internal to `libs/skill-editor`.
- `libs/skill-editor`'s `SkillEditor` component (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`) already renders a controlled/uncontrolled `selectedPath` file tree (`SkillEditorProps.selectedPath`/`onSelectedPathChange`, `libs/skill-editor/src/models/skill-editor-props.ts:168-171`) and already special-cases "a supporting file (not `SKILL.md` or a folder) is selected": it shows a static `labels.supportingFileNote` in the main pane instead of the SKILL.md form (`skill-editor-props.ts:115-116`). Today that note is just text — there is no content behind it. The lib has zero imports of attachment-canvas, i18n, routing, or app contexts (confirmed via grep of `libs/skill-editor/src`), and its own spec (`openspec/specs/skill-editor-library/spec.md:19-32`) forbids adding any.
- Chat's attachment preview already solves "show me this file's content": `AttachmentCanvasProvider`/`useAttachmentCanvas` (`libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx`) is a pure, host-agnostic state container (open/loading/content/fileName/attachmentId) already mounted globally in `apps/chat/src/main.tsx:57`, above the router. `AttachmentCanvasContainer` (`libs/attachment-canvas/src/components/AttachmentCanvasContainer/AttachmentCanvasContainer.tsx`) is a thin context-connected wrapper that renders `AttachmentCanvas`, which itself is `<SidebarPanel orientation={Right} resizable ...>` (`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx:451-611`) — i.e. **a resizable right-hand layout column**, not an overlay. It is mounted today only when `isConversationRoute && isAttachmentsManagerEnabled` (`apps/chat/src/app/app.tsx:531-532`); `/skill-editor` matches neither `ROUTES.Root` nor `ROUTES.Conversations`, so it never renders on the Skill Editor route today.
- `useOpenAttachmentCanvas` (`apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`) is the MIME/extension router that turns a `DisplayAttachment` into `AttachmentCanvasContent` and calls `openCanvas`. It also calls `closePanel()`/`closeSourcesPanel()` — conversation-panel-specific side effects not applicable to Skill Editor.
- `apps/chat/src/utils/attachment-canvas.ts` holds the actual content resolvers (`resolveMarkdownCanvasContent`, `resolveJsonCanvasContent`, `resolveCodeCanvasContent`, `resolveTextCanvasContent`, `resolveImageCanvasContent`, `resolvePdfCanvasContent`, `resolveHtmlCanvasContent`, `resolveVisualizerCanvasContent`), all funneling through `resolveAttachmentBlobUrl`/`resolveAttachmentText`.

### Figma findings (node `513:49374`, file `huBIe1WnVCnB2mAKEnGjMW`)

The inspected frame ("Create skill - many files - py file review") shows `generate_review.py` selected in the Files tree with its content rendered **inline in the existing main "Workspace" pane** — line-numbered, syntax-highlighted, titled with the filename — in the exact position where the SKILL.md form normally sits. There is:
- **No separate "Preview" trigger** — selecting the file row is the only interaction shown; row selection directly swaps the main-pane content.
- **No visible download button, no close button, no toolbar** in that pane (the viewer is inline in the page layout, not a panel that opens/closes).
- **No visual distinction for `SKILL.md`** in this particular screenshot state — it renders with a plain `file-type-md` icon like any other Markdown file; nothing indicates a different interaction when it's the selected node.
- **No mobile variant could be located.** `get_metadata` on the file returned only an unrelated `Thumbnail` page; the node's containing page/canvas could not be enumerated with the available tools. This is an unresolved investigation gap, not evidence that no mobile variant exists.
- **Code Connect data was unavailable** (seat/plan limitation) — no confirmed mapping from Figma components to repo components.

This directly conflicts with the assumption that the existing global, `SidebarPanel`-based `AttachmentCanvasContainer` — a resizable **column to the right of the whole page** — can represent this design: mounting that column on `/skill-editor` would add a *third* layout column (Files tree, Workspace/form, attachment sidebar) instead of swapping the Workspace pane's own content, which is what Figma shows. See Decision 1.

## Goals / Non-Goals

**Goals:**
- Selecting a supporting file in the Skill Editor's file tree (create or edit mode) previews its content using the same renderers, MIME/type routing, download, and object-URL lifecycle as chat's attachment canvas.
- No new BFF/Core request for preview — read from the in-memory bytes the editor already holds.
- Keep `libs/skill-editor` free of attachment-canvas, app-context, routing, and serialization knowledge.
- Fix the zero-byte-file and MIME-inference gaps in the shared attachment pipeline generically, with chat regression coverage, since Skill files expose them but they are not Skill-specific bugs.

**Non-Goals:**
- No new Skill-specific file viewer, renderer, or MIME table.
- No change to the create (`POST /api/v1/skills`)/update (`PUT /api/v1/skills`) contract, ETag handling, or multipart upload shape.
- No change to `skill-editing`/`skill-authoring`'s save/load/error-mapping requirements — only their file-selection interaction gains a new effect.
- Pixel-exact mobile layout is deferred until the mobile variant gap (below) is resolved with design; this change still implements a mobile-safe **default** (44×44px targets, no horizontal scroll, logical properties) per the repo's standing responsive/a11y rules, but does not claim Figma mobile parity.

## Decisions

### 1. Reuse attachment-canvas's content renderers via a new `AttachmentCanvasBody`, not the global `AttachmentCanvasContainer` sidebar

**Decision:** Extract the pure content-rendering part of `AttachmentCanvas` (`libs/attachment-canvas/src/components/AttachmentCanvas/AttachmentCanvas.tsx:262-448` — the `bodyContainerClassName`/`renderedContent` switch over `AttachmentContentType`, plus the top-level loading spinner) into a new exported component, `AttachmentCanvasBody`, taking the same `content`/`isLoading`/`fileName`/labels/`codeBlockTheme` inputs it already closes over. `AttachmentCanvas` keeps its exact current behavior, now composed as `<SidebarPanel>` chrome (header, close, copy, download) wrapping `<AttachmentCanvasBody>`. No visual or behavioral change for existing chat callers — verified by keeping `AttachmentCanvas`'s existing test suite green plus new tests asserting `AttachmentCanvasBody` renders identically to the pre-extraction inline switch.

The Skill Editor then renders its own minimal, Figma-shaped header (filename + Close + Download, reusing the existing `downloadAttachmentContent`/copy-handler logic already in `AttachmentCanvasContainer`) around `<AttachmentCanvasBody>`, mounted inline in place of the lib's `supportingFileNote` slot (Decision 2) — matching the Figma placement exactly, while reusing 100% of the type-specific rendering, no new renderer code.

**Alternatives considered:**
1. *Reuse `useOpenAttachmentCanvas` + the global `AttachmentCanvasContainer` as-is*, gated by `(isConversationRoute && isAttachmentsManagerEnabled) || isSkillEditorRoute` on `app.tsx`. **Rejected**: `AttachmentCanvasContainer` is a `SidebarPanel`-based right-hand column; Figma shows the preview replacing the main Workspace pane's content, not adding a third column. Using it as specified would render a UI that does not match the design.
2. *Reuse the generic attachment content/rendering primitives inside a differently-placed canvas* (this decision). **Chosen** — Figma's placement can't be represented by the existing sidebar container, so this is exactly the case the proposal's own alternative-2 criterion calls for. The extraction is small, mechanical, and behavior-preserving for existing callers.
3. *Build a Skill-specific viewer.* **Rejected** — duplicates routing, security (sandboxed HTML), accessibility, and rendering behavior already solved once in `attachment-canvas`.

This means the `app.tsx` route-gate change described in the proposal's initial framing (`(isConversationRoute && isAttachmentsManagerEnabled) || isSkillEditorRoute` for `AttachmentCanvasContainer`) is **not** applied — the Skill Editor route never mounts the global sidebar container, so that specific gate change is unnecessary. `AttachmentCanvasProvider`'s context is already available globally via `main.tsx`, which is all this design needs.

### 2. `libs/skill-editor` gets a new `supportingFileContent?: ReactNode` prop, not a new callback

**Decision:** Add `supportingFileContent?: ReactNode` to `SkillEditorProps`, rendered in the main pane instead of `labels.supportingFileNote` whenever a supporting file is selected and `supportingFileContent` is provided (falls back to the existing static note when omitted, so this is backward compatible for any other host). This follows the exact pattern already used for `headerContent` (`skill-editor-props.ts:210-215`) — host-rendered `ReactNode`, lib has zero knowledge of its contents.

The existing `selectedPath`/`onSelectedPathChange` controlled pair is reused as-is to detect the "which file, if any, is selected" signal at the app level; no new `onPreviewFile`/`onSelectFile` callback is added, because the app already receives every selection change through `onSelectedPathChange` and can look up `SkillFileTreeNode.kind`/`path === 'SKILL.md'` itself to decide whether to render `supportingFileContent`.

**Alternatives considered:** an `onPreviewFile?: (path: string) => void` callback (suggested as a fallback in the initial framing) would duplicate information `onSelectedPathChange` already provides and would still need a way for the host to inject the rendered preview into the main pane — i.e. it doesn't remove the need for a content slot, it only adds a second, redundant event. Rejected as unnecessary given `selectedPath` already exists.

### 3. App-level file → `DisplayAttachment` conversion, keyed by full relative path

`apps/chat/src/pages/SkillEditor/SkillEditor.tsx` adds a small conversion function (co-located in a new `apps/chat/src/pages/SkillEditor/utils/skill-file-preview.ts` or added to the existing `apps/chat/src/utils/skill.ts`, per file-naming conventions) that, given a `SkillFileTreeNode` and the corresponding `Uint8Array`/`File`/mime metadata, produces an `Attachment` (`libs/chat-shared/src/models/chat.ts:251-254`) with:
- `id`/`attachmentId` = the file's full relative path (e.g. `agents/analyzer.md`) — **not** the chat-DTO `dto.url ?? dto.data ?? dto.title` derivation, which collides on basename alone (`message-attachment-to-display.ts`). This directly closes the ID-collision gap the investigation found.
- `type` from the existing `AttachmentType` classification (`Image`/`Audio`/`File`) by MIME prefix, matching `getAttachmentType`'s existing logic.
- `contentType` from `File.type` when the bytes came from a fresh browser upload, else inferred from the path (Decision 4) for edit-mode ZIP entries that carry no MIME metadata.
- `status: RequestStatus.Idle`.
- `file: File` constructed from the in-memory bytes (`new File([bytes], name, { type: contentType })`) so the existing local-`File` resolver branches in `apps/chat/src/utils/attachment-canvas.ts` (blob URL / text / image) apply unchanged — no base64 encoding, no object-URL management added at the Skill Editor layer; `AttachmentCanvasContext`'s existing cleanup effect (`AttachmentCanvasContext.tsx:113-121`) already revokes any `blob:` URL created for `Image`/`Audio`/`Pdf` content on the next `content` change or unmount.

The app then calls `useOpenAttachmentCanvas().openAttachmentCanvas(attachment, attachment.id)`, explicitly passing the path-based id as `canvasAttachmentId` (the hook already supports this override for exactly this reason).

**Non-conversation side effects**: `useOpenAttachmentCanvas` also calls `closePanel()`/`closeSourcesPanel()`. Since Skill Editor has no conversation panel or sources panel mounted, these are no-ops through their respective providers' guard hooks — safe to reuse unmodified rather than forking the hook. This is verified, not assumed, as part of implementation (task to add a unit test asserting no throw/side effect on the Skill Editor route).

### 4. Generic path→MIME inference helper, extracted rather than duplicated

**Decision:** Add a small, generic `inferMimeTypeFromPath(path: string): MIMEType | undefined` utility to `libs/chat-shared/src/utils/` (co-located with or replacing the ad hoc 4-entry `EXTENSION_MIME_TYPES` in `message-attachment-to-display.ts`, which becomes a thin caller of the new shared table). The table covers the extensions already meaningful to `attachment-canvas`'s own routing (`.md`/`.markdown`, `.json`, `.pdf`, `.html`/`.htm`, common image/audio extensions, common source-code extensions already recognized by `EXTENSION_TO_LANGUAGE` in `libs/attachment-canvas/src/utils/content.ts`) — reusing the sets that already exist instead of inventing a new one. Used only when a Skill supporting file's bytes came from the edit-mode ZIP unpack (no browser `File.type`); browser-uploaded files always keep their `File.type` per Decision 3.

**Alternatives considered:** a Skill-local extension table in `apps/chat/src/utils/skill.ts`. Rejected per the proposal's explicit instruction — this is a generic gap (the same problem exists for any local/in-memory file without browser MIME metadata, not just Skills), so the fix belongs in shared code with chat-facing tests, not duplicated per feature.

### 5. Zero-byte local file fix, applied at all three affected call sites

**Decision:** In `apps/chat/src/utils/attachment-canvas.ts`, change the local-`File` gate from `(attachment as Attachment).file.size > 0` to `'file' in attachment` (drop the size check) in all three places it appears: `resolveAttachmentBlobUrl` (:190), `resolveAttachmentText` (:239), `hasAttachmentTextSource` (:251-256), and `resolveImageCanvasContent` (:268). A zero-byte text/code/markdown/JSON file must resolve to empty text (`''`) — which every downstream `resolveTextCanvasContent`/`resolveMarkdownCanvasContent`/`resolveCodeCanvasContent`/`resolveJsonCanvasContent` already treats correctly, since only `result == null` (not falsy/empty) is treated as "missing" (`:295`, `:305`, `:318`, `:428`). A zero-byte image/audio/PDF still produces a blob URL that the browser will fail to render — that failure is already handled by each renderer's existing `onError`/error-content path (`ImageContent`'s `onError`, `PdfContent`'s load-failure state), so no new error-handling branch is needed for those types.

**Regression scope:** this is a chat-facing fix (any locally-picked empty file in a conversation hits the same gate today), so its tests live in the existing `apps/chat/src/hooks/attachment/tests/useOpenAttachmentCanvas.spec.ts` / a new `attachment-canvas.spec.ts` for the resolvers, not only in Skill Editor tests.

### 6. `SKILL.md` and folder selection stay in the lib exactly as documented today

No change to `skill-editor-library`'s existing rule that selecting `SKILL.md` shows the manifest form and a folder row only selects/expands. The app only supplies `supportingFileContent` when `selectedPath` resolves to a `SkillFileTreeNode` with `kind: File` (i.e., excludes `SKILL.md` and any folder path) — enforced by the lib's existing rendering branch, not a new one.

### 7. Preview lifecycle, keyed by path, latest-wins

- **Replace on new selection**: `onSelectedPathChange` fires on every tree click; the app's `useEffect` on `selectedPath` re-derives and re-opens the canvas, naturally replacing prior content (`AttachmentCanvasContext.openCanvas` always overwrites `content`/`fileName`/`attachmentId`).
- **No duplicate on re-click of the same file**: the effect is keyed on `selectedPath`, so re-selecting the already-open path is a no-op render (React state unchanged) rather than a duplicate `openCanvas` call — guarded with a ref comparison against the last-opened path if `openCanvas` proves not to be idempotent enough by inspection during implementation.
- **Removing the previewed file closes the canvas**: `onRemoveNode`'s existing app-level handler, after deleting from `filesContentRef`, checks whether the removed path is the currently previewed path and calls `closeCanvas()` if so.
- **Replacing file content refreshes the preview**: `onUploadFile` for an existing path (replace) re-triggers the same selection effect since the underlying bytes for `selectedPath` changed — the effect depends on the content-bytes reference (from `filesContentRef`), not only the path string.
- **Latest-selection-wins under async resolution**: `useOpenAttachmentCanvas`'s existing `openCanvasLoading` → resolve → `openCanvas` sequence already races on `AttachmentCanvasContext.attachmentId`/`content` writes; the app's effect passes an `AbortController`-backed cancelled flag (per the repo's standing async-hook convention, `useFavicon.ts` pattern) so a slow resolution for file A cannot call `openCanvas` after file B has already been selected. This mirrors `useFavicon`'s cancelled-flag pattern rather than inventing a new one.
- **Leaving the Skill Editor closes the canvas**: a cleanup effect on unmount calls `closeCanvas()`.
- **Switching create ↔ edit resources closes stale content**: keyed off the same `id`/mode transition that already resets `filesContentRef`/`loadedPathRef` in `SkillEditor.tsx`.

### 8. Download reuses `downloadAttachmentContent` unmodified

Per the investigation, `downloadAttachmentContent` (`libs/attachment-canvas/src/utils/download.ts:44-100`) already operates on the resolved `AttachmentCanvasContent` (`content.text`/`content.value` for text-like types, `content.url` for binary types), not on any chat-attachment-record assumption. Since Decision 3 produces a local `File`-backed `Attachment`, the existing local-`File` resolver branches already produce exactly this shape (e.g. a `blob:` URL from the in-memory bytes for images/PDF/audio, direct text for text-like types) — so Download reproduces the original bytes correctly with **no new prop or callback** on `AttachmentCanvasBody`/`AttachmentCanvas`/`AttachmentCanvasContainer`.

## Risks / Trade-offs

- **[Risk]** The `AttachmentCanvasBody` extraction touches a widely-used, sensitive chat component. → **Mitigation**: pure extraction, no logic change; keep 100% of `AttachmentCanvas`'s existing tests green as the acceptance bar before adding any new test, plus a new test file for `AttachmentCanvasBody` covering every `AttachmentContentType`.
- **[Risk]** No mobile Figma variant was found, so the mobile layout of the inline preview is a judgment call, not a verified design match. → **Mitigation**: implement the repo's standing mobile-first defaults (44×44px targets, no horizontal scroll at 360px, logical properties, `useIsMobile` where a different component tree is genuinely required) and flag this explicitly as an open question below rather than presenting it as Figma-verified.
- **[Risk]** Reusing `useOpenAttachmentCanvas` (a conversation-page hook) from a non-conversation page could silently depend on a context Skill Editor doesn't provide. → **Mitigation**: explicit unit test mounting the hook under the Skill Editor's actual provider tree (no `ConversationPanelProvider`/`SourcesSidebarProvider` overrides beyond what `main.tsx` already supplies globally) asserting no throw.
- **[Risk]** The zero-byte and MIME-inference fixes are shared-code changes that could regress existing chat attachment behavior. → **Mitigation**: both are covered by dedicated chat-facing regression tests before the Skill Editor call sites are wired up (risk-first ordering in tasks.md).
- **[Trade-off]** `supportingFileContent` as a bare `ReactNode` gives the app full control but no lib-level guarantee about its accessibility shape (region name, focus return). → Accepted: the app owns those a11y requirements directly (see specs), consistent with how `headerContent` already works.

## Migration Plan

Additive, no data migration. Deploy as a single frontend release; if regressions surface, revert the `SkillEditor.tsx` wiring and the `SkillEditorProps.supportingFileContent` prop independently of the zero-byte/MIME fixes (those are backward-compatible and safe to keep).

## Open Questions

1. **Mobile variant**: no mobile Figma frame for this screen could be located with the available tools. Needs a design follow-up before mobile visual parity can be claimed; this change ships a functionally-safe mobile default in the meantime.
2. **Code Connect mappings**: unavailable (seat/plan limitation) for this Figma file — implementation should re-check `getEntityDetails`/`searchEntity` on the ui-kit MCP for the closest existing components (icon-buttons, tree row, code viewer chrome) rather than hand-rolling styles, but no confirmed Figma→component mapping exists to follow mechanically.
3. ~~**Exact desktop chrome around the inline preview**~~ — **Resolved during implementation**: after two rounds of live testing, the app owner confirmed no Download/Close chrome is wanted around the inline preview, matching Figma's own lack of any such control. `SkillFilePreview` was simplified to render only `AttachmentCanvasBody`'s content, with no wrapping header at all; returning to `SKILL.md` is done by re-selecting it in the file tree (already-existing behavior, not a new control). Decision 1's "minimal Figma-shaped header (filename + Close + Download)" and Decision 8's Download wiring describe the mechanism this could still use if a future design pass reinstates such a control (`downloadAttachmentContent` remains reusable, no code was removed from `libs/attachment-canvas` itself) — they are not the shipped behavior.
