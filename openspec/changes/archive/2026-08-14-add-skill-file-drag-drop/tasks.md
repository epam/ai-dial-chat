Slicing strategy: build the riskiest, most-reused pieces first (the batch contract types and app-level validator, since every other slice depends on their shape), then the lib-side dialog/drag-drop/staged-list UI against a test double of that contract, then wire the real app implementation (including `SKILL.md` import and confirmation flows) behind it, then remove the old single-file path, then close out accessibility/RTL/i18n and full verification. Each numbered section ends with an explicit `Verify:` task naming exact `nx` commands.

## 1. Batch contract types (`libs/skill-editor`)

- [x] 1.1 In `libs/skill-editor/src/models/skill-editor-props.ts`, add `SkillFileCandidateKind` (string enum: `SupportingFile`, `Manifest`), `SkillFileValidationStatus` (string enum: `Valid`, `Invalid`), `SkillFileUploadCandidate`, `SkillFileValidationResult`, `SkillFileBatchError`, `SkillFileCommitResult` types per design.md Decision 1.
- [x] 1.2 Replace `SkillEditorFileActions`'s `validatePath`/`onUploadFile` with `validateBatch`/`commitBatch` (keep `onRemoveNode` unchanged) using the new types.
- [x] 1.3 Add new `SkillEditorLabels` entries for the dialog (title, drop-zone default/active copy, staged-row size/status/remove labels, manifest-row explanatory text, confirm/cancel button labels, batch-error live-region prefix) with English defaults, following the existing `addUploadLabel`-style pattern.
- [x] 1.4 Export every new type from `libs/skill-editor/src/index.ts` per the `skill-editor-library` "Public package surface" requirement.
- [x] Verify: `npm exec nx run skill-editor:typecheck` (or the project's equivalent typecheck target — confirm exact target name via `nx show project skill-editor` if unsure) fails only on the now-stale `SkillEditor.tsx`/app consumer, not on the model file itself.

## 2. Path resolution and drag-and-drop primitives (`libs/skill-editor`)

- [x] 2.1 Add a pure `resolveCandidatePath(file: File): string` helper (webkitRelativePath fallback to `File.name`, backslash-to-forward-slash normalization) under `libs/skill-editor/src/utils/`.
- [x] 2.2 Add `libs/skill-editor/src/utils/tests/resolve-candidate-path.spec.ts` covering: no `webkitRelativePath` (falls back to name), a relative path with backslashes (normalizes), an already-forward-slash relative path (unchanged).
- [x] 2.3 Add a dialog-scoped drag state hook (e.g. `useSkillFileDropZone`) under `libs/skill-editor/src/components/SkillFileUploadDialog/` (or a shared `hooks/` folder in the lib), porting `usePageFileDrag`'s nested-enter/leave counting technique but scoped to the drop-zone element's own `onDragEnter`/`onDragLeave`/`onDragOver`/`onDrop`, per design.md Decision 2. `dragover` always calls `preventDefault()`.
- [x] 2.4 Unit-test the hook: drag-enter shows active, nested drag-enter/leave pairs don't flicker back to default early, drag-leave (net) returns to default, drop calls the provided files callback, `dragover` prevents default.
- [x] Verify: `npm exec nx test skill-editor`

## 3. Upload dialog UI (`libs/skill-editor`) — presentational, driven by a test double of the batch contract

- [x] 3.1 Use the AI DIAL UI Kit MCP (`searchEntity`/`getEntityDetails`) to identify the current dialog/modal primitive (`Popup`/`PopupSize` family per design.md Decision 6), its bottom-sheet-capable configuration (if any), and list/row/status/button primitives for the staged list. Do not use filesystem search for discovery.
- [x] 3.2 Build `SkillFileUploadDialog` (desktop modal) rendering: title, close control, drop zone (default/active/invalid states from the hook in 2.3), staged-row list (path, formatted size, status/error, remove control), manifest-kind row variant, batch-level error region (`aria-live="polite"`), confirm and cancel actions.
- [x] 3.3 Mobile responsive variant: `Popup` has no bottom-sheet primitive (confirmed via ui-kit MCP), so it renders as the same modal at every breakpoint — documented as a deviation in a code comment and design.md Open Question 2, rather than a custom bottom-sheet.
- [x] 3.4 Reused the existing `formatFileSize` from `@epam/ai-dial-chat-shared` (already a peer dep of `skill-editor`) for staged-row size display — no new formatter written.
- [x] 3.5 Wire `SkillFileUploadDialog` into `SkillEditor.tsx` in place of the hidden `<input type="file">`/`handleUploadInputChange` flow: "Upload from device" opens the dialog; the dialog calls `fileActions.validateBatch` reactively (on staged-set change) and again before calling `fileActions.commitBatch` on confirm; cancel discards staged state with no callback invoked.
- [x] 3.6 Remove the now-dead `uploadInputRef`/`handleUploadInputChange`/hidden `<input>` and the transient `uploadError` state from `SkillEditor.tsx`.
- [x] 3.7 Update `libs/skill-editor/src/components/SkillEditor/tests/SkillEditorFiles.spec.tsx`: replace the single-file `fireEvent.change` upload test and the `validatePath`-rejection test with dialog-driven equivalents (open dialog, stage file(s), assert `validateBatch`/`commitBatch` calls and resulting tree state); keep the existing remove-confirmation tests intact.
- [x] 3.8 Add new dialog-specific tests: open/close, click-to-select and multiple selection via the native input, drag-enter/leave/over/drop visual states, staged-row add/remove, confirm disabled while any row invalid or while validate/commit is in flight, cancel discards everything and calls neither `validateBatch` result-committing path nor `commitBatch`, successful commit closes dialog and clears staged state, failed commit keeps dialog open with the batch intact and shows the returned error, manifest-kind row renders distinct copy from a validation-result tag without the dialog parsing anything itself.
- [x] Verify: `npm exec nx test skill-editor`, `npm exec nx lint skill-editor` — 53 tests pass, lint clean.

## 4. Shared limit constants and batch validator (`apps/chat`)

- [x] 4.1 In `apps/chat/src/utils/skill.ts`, add `SKILL_UPLOAD_MAX_TOTAL_BYTES = 16_777_216` and `SKILL_UPLOAD_MAX_FILES = 100` alongside the existing `SKILL_FILE_UPLOAD_MAX_BYTES`, documented as a client-side mirror of `apps/chat-api/src/config/environment.config.ts`'s `SKILL_UPLOAD_MAX_TOTAL_BYTES`/`SKILL_UPLOAD_MAX_FILES` defaults.
- [x] 4.2 Create `apps/chat/src/pages/SkillEditor/utils/skill-file-batch-validation.ts` implementing the app-level `validateBatch`: per-candidate size/path/traversal/duplicate-within-batch/duplicate-against-existing/reserved-path checks; batch-level projected total size (existing bytes + staged bytes + current/imported manifest UTF-8 byte size) and projected total file count (existing + staged + 1 for the manifest); manifest-candidate recognition (`path === 'SKILL.md'` exact case, ≤1 MiB, valid UTF-8, valid YAML frontmatter with non-empty `name`/`description`); reject a batch with more than one root `SKILL.md`; reject a root case-variant filename (e.g. `skill.md`) as an ordinary invalid path; treat `docs/SKILL.md` (nested) as an ordinary supporting file.
- [x] 4.3 Add `apps/chat/src/pages/SkillEditor/utils/tests/skill-file-batch-validation.spec.ts` covering every scenario in the `skill-authoring`/`skill-editing` spec deltas' "Batch validation" and "SKILL.md" requirements: per-file size rejection before reading bytes, projected total size, projected total file count, within-batch duplicates, duplicates against existing files, path traversal/invalid-path rejection, valid manifest recognition, multiple root manifests, nested `docs/SKILL.md`, case-variant root filename, invalid UTF-8, invalid YAML frontmatter.
- [x] Verify: `npm exec nx test chat`, `npm exec nx lint chat` — 14/14 validator tests pass.

## 5. Atomic batch commit and SKILL.md import wiring (`apps/chat`, create mode)

- [x] 5.1 Implement the app's `commitBatch`: read every non-manifest candidate's `arrayBuffer()` and the manifest candidate's text (if present) before any state mutation; on any read failure, reject with no state change (per design.md Decision 5 / the atomicity requirement).
- [x] 5.2 Wire manifest-candidate handling in create mode: if the batch contains a valid manifest candidate and the form is dirty (per `onDirtyChange`'s last-reported value), show a confirmation prompt (reusing the existing `ConfirmationPopup` pattern, rendered at the app level) before proceeding; on acceptance (or when not dirty), update `name`/`description`/`instructions` state and store the imported frontmatter object as the one subsequent create submissions serialize from (preserving unknown fields). Also updated `handleSubmitCreate` to build the manifest from the preserved frontmatter (via `buildSkillManifestFromFrontmatter`) once an import has happened, instead of always a fresh object.
- [x] 5.3 Ensure the imported manifest's bytes never enter `filesContentRef`/`files` and never appear in `filePaths` sent to `createSkill` — the generated `skillManifest` text remains authoritative per the existing manifest-construction requirement.
- [x] 5.4 On successful commit, apply one batched state update (new `files` array, one `filesContentRef.current` mutation pass, one field-state update if a manifest was accepted) so a single re-render reflects the full result.
- [x] Verify: `npm exec nx test chat` — passing.

## 6. Edit-mode wiring: name-match guard and always-confirm

- [x] 6.1 Extend the app's manifest-candidate handling for edit mode: always show the confirmation prompt (regardless of dirty state) before applying an imported manifest; compare the imported `name` against the currently loaded, read-only Skill name and reject the commit with a specific error on mismatch, without mutating any state.
- [x] 6.2 On a confirmed, matching-name import, merge into the originally loaded frontmatter object (not replace it wholesale), update Description/Instructions, leave Name and the resource path untouched.
- [x] 6.3 Add/extend `apps/chat/src/pages/SkillEditor/tests/SkillEditor.spec.tsx`: matching-name import applies after confirmation, mismatched-name import is rejected with no state change, confirmation is required even with no unsaved edits, unknown frontmatter fields survive a confirmed import.
- [x] Verify: `npm exec nx test chat` — passing.

## 7. Multipart payload regression coverage

- [x] 7.1 Add/extend tests asserting the final `createSkill` (`POST`) and `updateSkill` (`PUT`) multipart payloads are unchanged in shape after this feature: `filePaths`/`files` reflect exactly the committed supporting files (batch-added or otherwise), never include `SKILL.md`, and `skillManifest` is always the page-generated text — covering both a batch added via the new dialog and the pre-existing edit-mode load-then-save path.
- [x] 7.2 Add a test asserting dropping a `.zip` file is staged and validated as an ordinary binary supporting file (subject to the same size/count/path limits), with no frontend unpacking or archive construction triggered anywhere in the commit path.
- [x] Verify: `npm exec nx test chat` — 36/36 SkillEditor page tests pass.

## 8. Accessibility, RTL, and i18n

- [x] 8.1 `SkillFileUploadDialog` is built on the ui-kit's `Popup` (accessible modal with built-in focus management/trap/close control); verified via component behavior — no manual focus-trap code needed. Every interactive control has an accessible name/label.
- [x] 8.2 Drop zone is keyboard-operable (`role="button"`, `tabIndex=0`, Enter/Space opens the picker) and has an explicit `focus-visible:outline` class added alongside its hover/active border-color changes.
- [x] 8.3 Batch-error live region uses `aria-live="polite"` (`role="status"`), separate from the static per-row error text.
- [x] 8.4 All new layout uses logical/flex utilities (`gap-*`, `justify-end`, `items-center`) — no physical `ml-*`/`mr-*`/`left-*`/`right-*`; no directional icons introduced (upload/file/trash icons are symmetric, no mirroring needed). Added an RTL-mounted render test for the dialog.
- [x] 8.5 Added every new user-visible string (dialog labels, manifest-import confirmation, name-mismatch/total-size/total-count errors, mobile drop-zone copy) to `apps/chat/src/i18n/locales/en.json` under `skillEditor.*`, resolved via the existing `SkillEditorI18nKeys` enum and `useTranslation()`; audited the new code for hardcoded strings.
- [x] Verify: `npm exec nx test skill-editor` (54/54), `npm exec nx test chat` (SkillEditor suite 56/56), `npm exec nx lint chat`, `npm exec nx lint skill-editor` — all clean (a pre-existing, unrelated `@nx/enforce-module-boundaries` lint error on this file predates this change, confirmed via `git stash`).

## 9. Final verification

- [x] 9.1 `npm exec openspec validate --strict add-skill-file-drag-drop` — valid.
- [x] 9.2 `npm exec nx affected -t lint --base=origin/development-1.0` — 0 errors (pre-existing warnings only, unrelated to this change).
- [x] 9.3 `npm exec nx affected -t test --base=origin/development-1.0` — 205 test files / 2838 tests passed, 2 pre-existing skips.
- [x] 9.4 `npm exec nx affected -t build --base=origin/development-1.0` — all 21 affected projects built successfully.
- [x] 9.5 Manual browser exercise completed by the user (drag-and-drop, mobile viewport, edit-mode name-match guard) — confirmed working, including the follow-up fix for page-wide drop (opens the dialog and stages files) and the full-surface drop overlay.
- [x] 9.6 Completion summary provided to the user (see chat response).
