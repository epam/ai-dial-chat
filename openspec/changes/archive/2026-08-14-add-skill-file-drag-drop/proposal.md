## Why

The Skill Editor's only way to add a supporting file today is a hidden, single-file `<input type="file">` triggered by "Upload from device" (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`, `handleUploadInputChange`). Users cannot drag files in, cannot select multiple files at once, and get no staging/review step before a file lands in the tree — each file is validated and uploaded one at a time with only a transient inline error on failure. The Skills Figma spec (node `604:12020` / `559:22242`, "Upload files from device") defines an explicit upload dialog with a drag-and-drop zone that the product now expects. Introducing it also requires widening the file-add contract to a batch, which surfaces an existing correctness gap: sequential single-file `validatePath` checks against a stale snapshot of `files` state don't safely handle same-name duplicates within one batch.

## What Changes

- Add a modal (desktop) / bottom-sheet (mobile) "Upload files from device" dialog to `libs/skill-editor`, opened from the existing "Upload from device" control, containing a drag-and-drop zone matching the Figma layout (click-to-browse fallback, default/active/invalid visual states).
- Support multi-file selection and multi-file drop, including additional drops while the dialog stays open.
- Add a staged-files list inside the dialog: each row shows the resolved relative path, formatted size, validation status/error, and a remove control. Confirming commits the entire valid batch to the editor atomically; canceling leaves the editor untouched.
- **BREAKING**: widen `SkillEditorFileActions` (`libs/skill-editor/src/models/skill-editor-props.ts:46-60`) from single-file (`validatePath`/`onUploadFile`) to a typed batch contract (validate-batch + commit-batch), since a single-file loop cannot safely detect within-batch duplicate paths or produce one atomic editor update. All current consumers of `SkillEditorFileActions` must migrate.
- Add app-level (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`) batch validation: per-file size (1 MiB), projected total package size (16 MiB), projected total file count (100, including the generated `SKILL.md`), path traversal/invalid-path rejection, in-batch and against-existing duplicate detection, reserved root paths — mirroring the BFF's authoritative `SkillsPackageService.validateAndBuildFormData` limits without duplicating magic numbers (shared constants).
- Add special-cased `SKILL.md` handling in the upload dialog: importing a root-relative `SKILL.md` parses YAML frontmatter and populates Name/Description/Instructions (with confirmation before overwriting dirty/existing fields), preserves unknown frontmatter, and is rejected in edit mode if its `name` doesn't match the read-only Skill name. It is never added to the supporting-file tree or sent as a supporting file to the BFF.
- No BFF/API contract changes: create (`POST /api/v1/skills`) and update (`PUT /api/v1/skills`) keep their existing structured multipart shape; no ZIP construction is introduced in the browser.

## Capabilities

### New Capabilities

- `skill-file-drag-drop`: the upload dialog, drag-and-drop interaction, multi-file staging/review UI, and batch commit/cancel behavior.

### Modified Capabilities

- `skill-editor-library`: replaces the "single 'Upload from device' control is the only way to add a supporting file" requirement with dialog-based multi-file add; replaces the single-file `SkillEditorFileActions` contract with a batch-oriented one.
- `skill-authoring`: create-mode file-add flow now runs batch validation (size/count/path/duplicate) and gains `SKILL.md`-import-to-form-fields behavior with confirmation-on-dirty.
- `skill-editing`: edit-mode file-add flow gains the same batch validation plus `SKILL.md`-import-with-name-match-guard and confirmation-before-replacing-manifest-fields behavior.

## Impact

- **Frontend library** (`libs/skill-editor`): new dialog/drop-zone/staged-list components, updated `SkillEditorProps`/`SkillEditorFileActions` models, updated `SkillEditorLabels` (new dialog/drop-zone/staged-row i18n strings), new tests.
- **Frontend app** (`apps/chat/src/pages/SkillEditor`): new batch validation module (size/count/path/duplicate, `SKILL.md` parsing/semantic validation, manifest-replacement confirmation), updated `fileActions` implementation wired to the new contract, shared limit constants reused from (or mirrored alongside) `apps/chat/src/utils/skill.ts`.
- **Reused patterns**: `libs/attachment-input/src/components/FileDndOverlay` (visual state precedent, not reused as-is — it's a full-page overlay, this is dialog-scoped) and `apps/chat/src/hooks/usePageFileDrag.ts` (document-level drag counting technique, adapted to a dialog-scoped root rather than `document`).
- **Backend**: none. Existing `POST`/`PUT /api/v1/skills` multipart contract and `SkillsPackageService` limits are read-only inputs to this change, not modified.
- **Breaking**: `SkillEditorFileActions` shape change is breaking for any consumer of `libs/skill-editor` (currently only `apps/chat`); this proposal includes migrating that one consumer in the same change.
- **Rollback**: revert the library/app commits; no persisted data or API contract is touched, so rollback is a pure code revert.
