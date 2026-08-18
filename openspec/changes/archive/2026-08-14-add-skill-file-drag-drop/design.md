## Context

Today `libs/skill-editor`'s `SkillEditor` (`libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx:150-248`) exposes exactly one add-file mechanism: a `NeutralButton` that clicks a hidden `<input type="file">` (no `multiple`), whose `onChange` reads `event.target.files?.[0]` and calls `fileActions.validatePath(file.name)` then `fileActions.onUploadFile(file, file.name)` — both defined on `SkillEditorFileActions` (`libs/skill-editor/src/models/skill-editor-props.ts:46-60`). The app-level implementation of that interface (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx:320-376`) owns path safety (`isValidSkillRelativePath`), duplicate-path detection against `files` state, a client-side 1 MiB per-file mirror of the BFF's limit, and appends bytes to `filesContentRef: Map<string, SkillFileContent>`.

The BFF (`apps/chat-api/src/skills/package/skills-package.service.ts:56-128`) is the authoritative validator on create/update: per-file size `SKILL_FILE_UPLOAD_MAX_BYTES` (1 MiB), total package size `SKILL_UPLOAD_MAX_TOTAL_BYTES` (16 MiB), max file count `SKILL_UPLOAD_MAX_FILES` (100, counting the manifest), reserved/duplicate/unsafe path rejection. The frontend already mirrors these for immediate feedback (`apps/chat/src/utils/skill.ts`) but only ever checks one file against one already-committed snapshot of `files` — never a whole incoming batch against itself.

The Figma reference (file `huBIe1WnVCnB2mAKEnGjMW`, desktop modal node `559:22384`, mobile bottom-sheet node `608:10749`, parent frame `604:12020`/`559:22242`) shows a titled dialog/bottom-sheet containing one dashed drop zone ("Drag and drop it or click here to upload" / "Click here to upload" on mobile, "File formats .md, .zip and .skill" caption) and nothing else — **no staged-file list, no per-row size/status/remove UI, no explicit Add/Cancel footer is present in the inspected frames.** The desktop variant is a centered `Modal Card` (480×272, `radius-3`, `spacing-06` padding); the mobile variant is a `bottom-sheet` instance with a drag handle, centered title, and a close icon-button, anchored to the bottom of the viewport. Per the task's explicit instruction, the "File formats .md, .zip and .skill" caption is visual copy from an earlier iteration of the design and must not become an enforced extension allowlist — the product's actual contract (BFF `SkillsPackageService`) has no extension restriction, only size/count/path limits.

`libs/attachment-input/src/components/FileDndOverlay` (79 lines) is a full-page, binary-state (allowed/denied) overlay driven by `apps/chat/src/hooks/usePageFileDrag.ts`'s document-level `dragenter`/`dragleave`/`dragover`/`drop` listeners with an `enterCountRef` nesting counter. Neither is directly reusable unmodified: the overlay is `fixed inset-0` (page-wide), and the hook targets `document`, not a scoped dialog root. `libs/conversation-input/src/hooks/useAttachments.ts` is the closest existing batch-upload precedent — `pendingDropFiles`/`onDropFilesConsumed` prop shape, `buildAttachments` batch mapping, `addAttachments`'s "filter already-present, revoke discarded object URLs" pattern, and a total-count-based batch rejection (`maximumAttachmentsAmount`) — but it does path-free, id-based dedup, not the path-based dedup Skill Editor needs.

## Goals / Non-Goals

**Goals:**
- Replace the single-file hidden-input flow with an explicit "Upload files from device" dialog (modal desktop / bottom-sheet mobile) offering both click-to-browse and drag-and-drop, matching the Figma chrome (title, close, dashed drop zone, default/active/invalid states).
- Support multi-file selection/drop, staging with per-file path/size/status/remove before commit, and an atomic all-or-nothing commit of the whole valid batch.
- Reuse the BFF's authoritative limits (1 MiB/file, 16 MiB total, 100 files) as shared frontend constants, projected across existing + staged files + the manifest's own byte size.
- Give `SKILL.md` first-class import handling: parse frontmatter, populate form fields (with confirmation against dirty state in create mode, and a hard name-match guard in edit mode), preserve unknown frontmatter.
- Keep `libs/skill-editor` free of REST/i18n/YAML/path-policy knowledge, per its existing spec's isolation requirement — the dialog and staged-list are presentational, driven by a typed batch contract the host (`apps/chat`) implements.

**Non-Goals:**
- No BFF/API contract change. `createSkill`/`updateSkill`'s multipart shape, `SkillsPackageService`'s limits, and DIAL Core's `SKILL.md` validation are unchanged; this proposal only changes how files reach the existing `fileActions`-equivalent boundary.
- No frontend ZIP/archive construction, and no unpacking of dropped `.zip`/`.skill` files — they are staged as ordinary binary supporting files subject to the same limits, exactly like any other unrecognized extension.
- No folder-drop / recursive directory traversal support — there is no existing browser-API precedent for it in this repo (confirmed zero `webkitRelativePath` usage anywhere today) and the inspected Figma frames don't show it; a dropped folder's individual files (if the browser's native `DataTransferItem` API happens to surface them) are treated as flat file entries the same way pasted files are, nothing more.
- No pixel-exact reproduction of a staged-file list from Figma — none exists in the inspected nodes. This design places the staged list inside the same dialog body, below the drop zone, using the AI DIAL UI Kit's existing list/row and status primitives (resolved via `searchEntity`/`getEntityDetails` at implementation time), and this deviation is called out explicitly rather than presented as Figma-verified.

## Decisions

### 1. Widen `SkillEditorFileActions` to a batch contract, with the dialog and drag-and-drop state owned entirely by `libs/skill-editor`

**Decision:** Replace `validatePath`/`onUploadFile` with:

```ts
export enum SkillFileCandidateKind {
  SupportingFile = 'supporting-file',
  Manifest = 'manifest', // exact case-sensitive root path "SKILL.md"
}

export enum SkillFileValidationStatus {
  Valid = 'valid',
  Invalid = 'invalid',
}

export interface SkillFileUploadCandidate {
  /** Stable id for React keys / remove targeting, independent of path edits. */
  id: string;
  file: File;
  /** Resolved via webkitRelativePath fallback File.name, slashes normalized to "/". */
  path: string;
}

export interface SkillFileValidationResult {
  candidateId: string;
  status: SkillFileValidationStatus;
  kind: SkillFileCandidateKind;
  /** Required when status is Invalid; rendered verbatim in the staged row. */
  error?: string;
}

/** Batch-level errors that aren't attributable to one row (total size/count). */
export interface SkillFileBatchError {
  message: string;
}

export interface SkillFileCommitResult {
  /** Rejected commit keeps the dialog open and staged list intact, showing this. */
  error?: string;
}

export interface SkillEditorFileActions {
  /** Called on every staged-set change (add/remove) and again immediately before commit. */
  validateBatch: (
    candidates: SkillFileUploadCandidate[],
  ) => Promise<{ results: SkillFileValidationResult[]; batchErrors: SkillFileBatchError[] }>;
  /** Called once, with the full currently-valid staged batch, when the user confirms. */
  commitBatch: (candidates: SkillFileUploadCandidate[]) => Promise<SkillFileCommitResult>;
  onRemoveNode: (path: string) => void;
}
```

The dialog (new `SkillFileUploadDialog` component inside `libs/skill-editor`) owns: open/close state, the drag-and-drop event handlers scoped to its own drop-zone element (not `document`), the native `<input type="file" multiple>` fallback, path resolution (`webkitRelativePath` → fallback `File.name`, `\` → `/` normalization — pure, host-agnostic `File`-API logic, not DIAL policy), the staged-candidate list and per-row remove control, calling `validateBatch` reactively (via `useEffect` keyed on the staged id list) to render status/error per row, disabling the confirm button while any result is `Invalid` or while `validateBatch`/`commitBatch` is in flight, and closing itself only after `commitBatch` resolves without an `error`.

**Alternatives considered:**
1. *Keep `onUploadFile(file, path)` single-file and have the dialog call it once per staged file in sequence.* Rejected — the app's `validatePath` already reads a stale `files` snapshot; sequential calls create a real race for same-name duplicates within one batch (two files named `notes.md` dropped together would both pass a pre-drop check), and per-file sequential awaits can't produce one atomic editor-state update if a later file's read fails after earlier ones already mutated state.
2. *Keep the contract host-driven end-to-end (host owns the entire dialog, lib exposes only an `isOpen`/`onOpenChange` pair).* Rejected — this would leak dialog presentation, drag-state, and staged-row rendering into the app layer, duplicating UI the lib should own per `skill-editor-library`'s existing isolation requirement, and would prevent reusing the same dialog shell for any other host of `SkillEditor` in the future.
3. *Make `validateBatch` synchronous.* Rejected — the manifest candidate (`SkillFileCandidateKind.Manifest`) requires reading and UTF-8-decoding file bytes to validate YAML frontmatter (§Decision 4), which is inherently async; keeping one async signature for the whole batch is simpler than a sync/async split by candidate kind.

### 2. Drag-and-drop state is a small new dialog-scoped hook, not a reuse of `usePageFileDrag`

**Decision:** Add a host-agnostic `useDropZoneDrag` hook (or inline state machine) inside `libs/skill-editor`, attaching `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` directly to the drop-zone `div` (not `document`), using the same nested-enter/leave counting technique `usePageFileDrag` already validates (`enterCountRef`), and calling `event.preventDefault()` on `dragover` to stop the browser from navigating to the dropped file. Visual states: `default` (idle), `active` (a file-bearing drag is currently over the zone — `event.dataTransfer.types.includes('Files')`), and `invalid` (reserved for a future host-supplied "reject this drag" signal, e.g. mirroring `FileDndOverlay`'s denied state; for this change, since there is no upload gate other than the limits already enforced post-drop, `invalid` is only shown after a drop already produced an all-invalid batch, not pre-drop).

**Alternatives considered:**
1. *Reuse `usePageFileDrag` unmodified by mounting it while the dialog is open.* Rejected — it listens on `document`, so any drag over the rest of the page (outside the dialog) while the dialog happens to be open would incorrectly trigger the dialog's active state; a modal's drop target must be scoped to itself.
2. *Extract `usePageFileDrag`'s counting logic into a shared host-agnostic hook `libs/attachment-input` exports, parameterized by target element.* Considered for later cleanup but out of scope here — `usePageFileDrag` remains page-scoped and untouched; duplicating ~20 lines of counting logic into a new lib-local hook is cheaper and lower-risk than refactoring a hook already used by the full chat conversation surface, for a one-time cost this small.

**Revised during implementation:** live testing showed dragging files onto the Skill Editor without first clicking "Upload from device" produced no feedback at all — the dialog's own drop zone only exists once the dialog is open, so a drag starting anywhere else on the editor was silently ignored. `SkillEditor.tsx` (the lib component, not just the dialog) now uses a second instance of the same `useSkillFileDropZone` hook, scoped to its own root container instead of the dialog's inner zone, to open the dialog and stage the dropped files in one step. The two instances don't conflict: the root-level handler no-ops (via an `isUploadDialogOpen` guard) once the dialog is already open, so a drop inside the dialog's own zone is staged exactly once, by the dialog's own handler. This stays consistent with the "no `document` listeners" decision above — the root container's own React drag events are used, not `document`, so no interference with `usePageFileDrag` elsewhere in the host app.

A second round of feedback asked for this to look like the rest of the product: chat's conversation composer already shows a full-screen drag overlay (`libs/attachment-input`'s `FileDndOverlay`, driven by `usePageFileDrag`) the moment a file-bearing drag starts, not just a subtle border. Rather than importing `FileDndOverlay` across from `libs/attachment-input` (no existing dependency between these two libs, and `FileDndOverlay`'s overlay is `position: fixed` covering the whole viewport, one visual layer up from what a single-route component like Skill Editor should own), a small self-contained `SkillFileDropOverlay` component was added inside `libs/skill-editor` itself, matching the same icon-title-subtitle visual pattern and `pointer-events-none`/`aria-live="polite"` behavior, but scoped with `absolute inset-0` to the editor's own (now `relative`-positioned) root container instead of the whole viewport. It renders whenever `isSurfaceDragActive && !isUploadDialogOpen`, using the same labels pattern (`dropOverlayTitle`/`dropOverlaySubtitle` on `SkillEditorLabels`) as every other host-facing string in this lib.

### 3. Shared limit constants live once, in `apps/chat/src/utils/skill.ts`, imported by both the new batch validator and the existing single-file mirror

**Decision:** `SKILL_FILE_UPLOAD_MAX_BYTES` (1 MiB), a new `SKILL_UPLOAD_MAX_TOTAL_BYTES` (16 MiB), and a new `SKILL_UPLOAD_MAX_FILES` (100) become the one frontend source of truth, defined once in `apps/chat/src/utils/skill.ts` (already the home of `SKILL_FILE_UPLOAD_MAX_BYTES` and `SKILL_MANIFEST_FILE`), matching the BFF's `environment.config.ts` defaults exactly as documented values (not fetched at runtime — the BFF remains authoritative and a `400`/`413` response is still mapped to a user-facing error regardless of what the client pre-checked). A new `apps/chat/src/pages/SkillEditor/utils/skill-file-batch-validation.ts` module implements the actual per-candidate/batch validation using these constants plus `isValidSkillRelativePath`, and is the concrete `validateBatch` the page passes as `fileActions`.

**Alternatives considered:** duplicating the three numbers directly inside the new batch-validation module. Rejected per the proposal's explicit "use shared constants rather than duplicating magic numbers" requirement, and because `apps/chat/src/utils/skill.ts` already owns the one existing limit constant — colocating the new two keeps a single file as the frontend's authoritative mirror.

### 4. `SKILL.md` special handling stays entirely in the app layer, surfaced to the lib only as a `kind` tag

**Decision:** The app's `validateBatch` recognizes a candidate whose `path === 'SKILL.md'` (exact case-sensitive root path) as `SkillFileCandidateKind.Manifest`, applies the 1 MiB limit, requires valid UTF-8 decoding, parses it with the existing `parseSkillManifest` (`apps/chat/src/utils/skill.ts`), and validates non-empty string `name`/`description` — same rule DIAL Core's own `SkillHandler.validate` enforces server-side. A batch with more than one root `SKILL.md` candidate fails batch validation with a `SkillFileBatchError`. A root-level case variant (`skill.md`, `Skill.md`, etc.) is treated as an ordinary (rejected) path with a message naming the exact required casing — it does not become a second manifest candidate. `docs/SKILL.md` (non-root) is an ordinary supporting file (`SkillFileCandidateKind.SupportingFile`), not a manifest candidate, since only the literal root-relative path is special.

The lib renders a `Manifest`-kind staged row with different copy (via a new `labels.manifestStagedRowNote` string, e.g. "Will replace this Skill's name, description, and instructions") but performs no parsing itself — it only ever sees the `kind` tag and the validation result the host already computed.

`commitBatch`, when the resolved batch contains a `Manifest` candidate:
1. In create mode, if the form is currently dirty (per the same dirty tracking `skill-editor-library` already reports via `onDirtyChange`), the app shows its own confirmation prompt (a `ConfirmationPopup`, rendered by the app, layered above the lib's dialog — the same pattern already used for the existing remove-file confirmation, just app-owned instead of lib-owned since the decision depends on app-level dirty/name-match state) before proceeding; declining leaves the dialog open with the batch still staged.
2. In edit mode, the app always confirms before replacing manifest fields, and additionally compares the imported `name` against the read-only current Skill name; a mismatch fails the commit with a specific `SkillFileCommitResult.error` (e.g. "Imported SKILL.md name doesn't match this Skill — renaming isn't supported") without touching any state.
3. On confirmed acceptance, the app merges the imported frontmatter into its retained original-frontmatter object (create mode: stores it fresh as the new "original" going forward, matching `skill-authoring`'s frontmatter-preservation requirement; edit mode: merges into the already-loaded original per `skill-editing`), updates `name`/`description`/`instructions` state, and proceeds to commit the remaining (non-manifest) candidates into `files`/`filesContentRef` in the same atomic update.

**Alternatives considered:**
1. *Push YAML parsing/frontmatter semantics into `libs/skill-editor`.* Rejected outright — `skill-editor-library`'s existing spec explicitly forbids `yaml` imports inside the lib; this would be a direct regression of an already-shipped isolation guarantee.
2. *Silently ignore a dropped `SKILL.md` (treat it as an ordinary, rejected reserved-path file, same as today's single-file flow already does via the `SKILL.md`-reserved check in `validatePath`).* Rejected — the proposal explicitly requires `SKILL.md` import to populate form fields; keeping today's blanket rejection would ship no new value for the single most useful drop target (a whole exported Skill folder).

### 5. Atomic commit: read all bytes first, mutate state once

**Decision:** `commitBatch`'s app-level implementation reads every non-manifest candidate's `file.arrayBuffer()` (and the manifest candidate's text, if present) before calling any state setter. If any read throws, the whole commit rejects with an error and **no** `files`/`filesContentRef`/form-field state changes are made — matching the existing single-file `onUploadFile`'s per-call atomicity, now guaranteed across the whole batch instead of only within one file. Only after every read succeeds does the implementation perform one batched state update (new `files` array via a single `setFiles`, one `filesContentRef.current` mutation pass, and — if a manifest candidate was accepted — one field-state update), so a component-level re-render sees the fully-committed result in one pass rather than N intermediate ones.

**Alternatives considered:** committing files one at a time as each read resolves (progressive UI feedback). Rejected — the proposal explicitly requires "never silently add only the valid subset of an invalid batch" and "make the batch commit atomic"; progressive per-file commits would violate atomicity the moment any later file's read failed after earlier ones had already landed in `files` state.

### 6. Dialog/drop-zone/staged-row UI kit primitives resolved at implementation time, not hand-rolled

**Decision:** The desktop variant uses whatever the ui kit's current dialog primitive is (`Popup`/`PopupSize`, the same family `ConfirmationPopup`, `PromptParametersPopup`, and `ChatSettingsModal` already build on) sized to roughly match the Figma modal's 480px width; the mobile variant renders through whatever bottom-sheet-capable variant that primitive exposes (or, if none exists, the closest full-width bottom-anchored `Popup` configuration) rather than introducing a new sheet component. Implementation MUST call `searchEntity`/`getEntityDetails` on the ui-kit MCP before choosing primitives for the dialog shell, drop zone, staged-row list, per-row status indicator, and buttons — no filesystem search of `node_modules` for component discovery, per the standing project rule.

**Alternatives considered:** hand-building a bespoke `<div>`-based modal. Rejected — duplicates focus-trap, `Escape`, and backdrop behavior the ui kit's dialog primitive already solves, and risks missing an AAA-accessibility guarantee (focus restoration, trapped focus) the shared primitive is presumed to already provide; any gap found during implementation gets raised against the ui kit per the project's stated policy for "genuinely can't fit" API gaps, not worked around locally.

## Risks / Trade-offs

- **[Risk]** `SkillEditorFileActions`'s shape change is a breaking change to `libs/skill-editor`'s public contract. → **Mitigation**: this change migrates its one real consumer (`apps/chat/src/pages/SkillEditor/SkillEditor.tsx`) in the same PR; no external consumer of `@epam/ai-dial-skill-editor` exists in this monorepo today (confirmed during exploration).
- **[Risk]** A dialog-scoped drag-and-drop implementation diverges subtly from `usePageFileDrag`'s already-battle-tested nested-enter/leave counting, reintroducing a flicker bug that hook was written to avoid. → **Mitigation**: port the counting technique verbatim (same `enterCountRef` pattern) rather than re-deriving it, and add the same drag-enter/leave/over/drop test coverage `FileDndOverlay`'s existing spec already exercises for the page-wide case.
- **[Risk]** No Figma staged-file-list reference exists, so its visual design is this change's own judgment call rather than a verified match. → **Mitigation**: documented explicitly in Non-Goals and as an Open Question below; built from existing ui-kit list/row primitives (Decision 6) so it stays visually consistent with the rest of the product even without a pixel reference.
- **[Risk]** Client-side batch validation (size/count/path) can drift from the BFF's authoritative `SkillsPackageService` limits if either side's constants change independently. → **Mitigation**: BFF error responses (`400`/`413`) remain the final word and are still mapped to user-facing errors exactly as `skill-authoring`'s existing HTTP-error-mapping requirement specifies; the client-side check is pure UX (fail fast, before a slow multipart upload), never the sole gate.
- **[Trade-off]** Making `validateBatch` always async (Decision 1) adds a microtask round-trip even for pure-size/path checks that could be synchronous. → Accepted: the manifest-candidate path genuinely needs to be async (UTF-8 decode), and a single uniform signature is simpler to test and reason about than a mixed sync/async contract.

## Migration Plan

Additive at the API-contract level (BFF unchanged); breaking only at the `SkillEditorFileActions` TypeScript interface, migrated in the same change alongside the library. Deploy as a single frontend release. Rollback is a pure code revert — no persisted data, migration script, or API version is touched. If a regression is found post-deploy, the prior single-file hidden-input flow can be restored by reverting this change's commits without any data cleanup.

## Open Questions

1. **Staged-file-list visual design** has no Figma reference at the inspected nodes (`604:12020`/`559:22242`) — this design builds it from existing ui-kit list/status primitives (Decision 6) and flags it as a deliberate, documented deviation rather than a verified match; a follow-up design pass could formalize it later.
2. **Bottom-sheet primitive availability**: whether the ui kit's `Popup` family already exposes a bottom-sheet-anchored variant, or whether the mobile layout needs a custom-positioned `Popup`, is resolved at implementation time via `getEntityDetails`/`searchEntity` (Decision 6) — not assumed here.
3. **`invalid` drag-state trigger**: the Figma frames show no distinct "drag rejected" visual (unlike `FileDndOverlay`'s allowed/denied binary), and this feature has no upload-time policy gate equivalent to chat's `isAttachmentsAllowed` (any file type is acceptable, limits are only size/count/path). The `invalid` visual state is therefore reserved for a post-drop all-invalid-batch result rather than a pre-drop drag signal; this can be revisited if product wants a pre-drop signal later (e.g. warning when the drag would obviously exceed the 100-file count).
