## Why

The Skill Editor (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`, `libs/skill-editor`) lets authors add supporting files (Markdown, code, HTML, images, audio, PDFs, etc.) to a Skill, but there is no way to see a file's content — selecting a supporting file in the Files tree does nothing today. Chat already solved this exact problem for conversation attachments with the attachment-canvas pipeline (`libs/attachment-canvas`, `apps/chat/src/hooks/attachment/useOpenAttachmentCanvas.ts`, `apps/chat/src/utils/attachment-canvas.ts`): a shared content-type router, a set of type-specific renderers (Markdown/JSON/Code/HTML/PDF/Image/Audio/Visualizer/Unsupported/Error), download, and object-URL lifecycle management. Skill files should look and behave like the same file opened as a chat attachment rather than growing a second, Skill-specific viewer.

## What Changes

- Add a supporting-file preview to the Skill Editor by opening the existing global attachment canvas (`AttachmentCanvasProvider` / `AttachmentCanvasContainer`) instead of building a new viewer.
- Extend `AttachmentCanvasContainer`'s route gate in `apps/chat/src/app/app.tsx` so it also renders on the Skill Editor route, decoupled from the unrelated `OverlayFeature.AttachmentsManager` flag for that route: `(isConversationRoute && isAttachmentsManagerEnabled) || isSkillEditorRoute`.
- Add an app-level adapter in `apps/chat/src/pages/SkillEditor/` that converts a selected in-memory supporting file (create-mode local upload or edit-mode unpacked ZIP entry) into the existing `DisplayAttachment`/`Attachment` shape and calls `useOpenAttachmentCanvas`, keyed by the file's full relative path (not `SkillFileTreeNode` basename) to avoid ID collisions between same-named files in different folders.
- Fix two generic gaps in the shared attachment pipeline surfaced by this reuse (with chat regression tests, not Skill-only patches):
  - `resolveAttachmentBlobUrl`/`resolveAttachmentText` (`apps/chat/src/utils/attachment-canvas.ts`) currently gate on `file.size > 0`, so a zero-byte local `File` is indistinguishable from "missing" — must resolve to valid empty content instead.
  - No generic path→MIME inference helper exists outside the citation-only 4-entry `EXTENSION_MIME_TYPES` table in `libs/chat-shared/src/utils/message-attachment-to-display.ts`; downloaded Skill ZIP entries need one to infer MIME type from a relative path when the original browser `File.type` isn't available.
- Wire `SkillEditor.tsx` to the existing `libs/skill-editor` controlled selection API (`selectedPath`/`onSelectedPathChange`) to detect "supporting file selected" vs. "`SKILL.md` selected" vs. "folder selected/expanded" and open/close/replace the canvas accordingly. No new prop is added to `libs/skill-editor` unless investigation during implementation proves the existing controlled props cannot express this (see design.md).
- **Modified Capability**: `skill-editing` — selecting a supporting file in edit mode now opens a preview; selecting `SKILL.md` still shows the manifest form.
- **Modified Capability**: `skill-authoring` — selecting a locally-uploaded supporting file in create mode now opens a preview.
- **Modified Capability**: `skill-editor-library` — adds a `supportingFileContent?: ReactNode` prop rendered in the main pane when a supporting file is selected, following the existing `headerContent` pattern; no new callback, no attachment-canvas dependency.

## Capabilities

### New Capabilities

- `skill-file-preview`: Opening, replacing, and closing an attachment-canvas preview of a Skill supporting file from the Skill Editor's file tree, for both create-mode (local uploads) and edit-mode (unpacked ZIP bytes), with no new BFF request.

### Modified Capabilities

- `skill-editing`: adds the file-selection → preview interaction to the edit-mode contract (does not change the save/load/ETag contract).
- `skill-authoring`: adds the file-selection → preview interaction to the create-mode contract (does not change the create-submission contract).

## Impact

- **Frontend app**: `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` (new preview wiring, file→attachment conversion), `apps/chat/src/app/app.tsx` (route gate for `AttachmentCanvasContainer`), `apps/chat/src/utils/attachment-canvas.ts` (zero-byte fix), possibly a new shared MIME-inference helper location (`libs/chat-shared` or `libs/attachment-canvas`).
- **Libraries**: `libs/skill-editor` — no new host/attachment-canvas dependency; at most a generic `onPreviewFile?: (path: string) => void` callback if `selectedPath`/`onSelectedPathChange` prove insufficient (open design question, see design.md). `libs/attachment-canvas` — no API change expected; download and object-URL lifecycle already work generically off `AttachmentCanvasContent`.
- **No backend/BFF change**: create-mode files are local and already in memory; edit-mode files are already unpacked from the whole-Skill ZIP download into memory. No new endpoint, no additional download request.
- **Breaking**: none. This is additive UI behavior; no existing endpoint, DTO, or spec contract changes shape.
- **Rollback**: revert the `app.tsx` route-gate change and the `SkillEditor.tsx` preview wiring; the zero-byte and MIME-helper fixes are backward compatible (they only change previously-"missing" behavior to a working one) and can be left in place or reverted independently.
