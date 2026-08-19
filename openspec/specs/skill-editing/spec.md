# skill-editing Specification

## Purpose
Specifies `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`'s edit-mode behavior: the `?id=...` route, ETag-gated load, frontmatter/file preservation, save via `updateSkill` with no ZIP rebuild, stale-edit conflict handling, immutable Name/path, dirty-navigation guard, and edit-specific labels.

## Requirements

### Requirement: `/skill-editor?id=...` route switches the page to edit mode
The system SHALL add `SkillEditorQuery.Id` (mirroring `PromptEditorQuery.Id`) to `apps/chat/src/types/skill-editor.ts`. Presence of a non-empty `id` query param SHALL switch `SkillEditor.tsx` to edit mode; its absence keeps create mode (unchanged, per the `skill-authoring` capability). The `id`'s bucket/relative-path SHALL be resolved safely — an `id` that fails to resolve to a well-formed bucket/path pair SHALL be treated as a load failure (see below), not passed through to `downloadSkill` unvalidated.

#### Scenario: id present switches to edit mode
- **WHEN** a user navigates to `/skill-editor?id=<bucket>%2Fteam-a%2Fdocs-helper`
- **THEN** the page renders in edit mode and begins loading that skill

#### Scenario: id absent stays in create mode
- **WHEN** a user navigates to `/skill-editor` with no `id` param
- **THEN** the page renders the create form exactly as the `skill-authoring` capability specifies, with no load attempt

### Requirement: Edit load requires an ETag and never falls back to an empty create form
On edit-mode load, the page SHALL call the existing `downloadSkill()` wrapper (`apps/chat/src/server-api/skills.api.ts`, already returning the raw `Response`) and SHALL treat a missing `ETag` response header as a load failure, even if the ZIP body itself is otherwise readable — an edit session with no ETag has no concurrency guard to send back on save. The page SHALL render one of: a loading state, a retryable load-error state (network/5xx/timeout), a forbidden state (`403`), or a not-found state (`404`) — and SHALL NOT, on any load failure, silently render the create form's empty fields as if the user were creating a new skill.

#### Scenario: Successful load populates the form
- **WHEN** `downloadSkill` resolves with a ZIP body and an `ETag` header
- **THEN** the page unpacks it, populates `name`/`description`/`instructions` and the file tree, and stores the ETag for the eventual save

#### Scenario: Missing ETag is a load failure
- **WHEN** `downloadSkill` resolves with a ZIP body but no `ETag` header
- **THEN** the page shows a retryable load-error state and does not populate the form

#### Scenario: Forbidden skill shows a forbidden state, not an empty form
- **WHEN** `downloadSkill` rejects with `403`
- **THEN** the page shows a forbidden state, distinct from both the load-error and not-found states

#### Scenario: Missing skill shows a not-found state, not an empty form
- **WHEN** `downloadSkill` rejects with `404`
- **THEN** the page shows a not-found state

#### Scenario: Retry re-attempts the same load
- **WHEN** a user activates Retry from the load-error state
- **THEN** the page calls `downloadSkill` again with the same `id`-derived bucket/path

### Requirement: Frontmatter and supporting files are unpacked and preserved for editing
On successful load, the page SHALL unpack the downloaded ZIP with `fflate`, parse the root `SKILL.md`'s YAML frontmatter with the `yaml` package's `parse` function keeping the entire parsed object (not just `name`/`description`), and load every other entry into an in-memory `Map<relativePath, Uint8Array>`. The file tree presented to `libs/skill-editor` SHALL be built from these real file paths plus any parent folders inferred from those paths — no server-side "folder" entities exist to load separately.

#### Scenario: Unknown frontmatter field is retained after load
- **WHEN** the loaded `SKILL.md` has a `version: "1.2.0"` field the form never renders
- **THEN** the page's in-memory frontmatter object still has `version: "1.2.0"` after load, ready to be re-serialized unchanged on save

#### Scenario: Supporting files load byte-for-byte
- **WHEN** the archive contains a binary `assets/logo.png` entry
- **THEN** the in-memory map holds that entry's exact decompressed bytes, unmodified

#### Scenario: File tree infers folders from paths
- **WHEN** the archive contains `agents/analyzer.md` and no separate folder marker for `agents`
- **THEN** the presented file tree shows an `agents` folder node containing `analyzer.md`, derived purely from the file's path

### Requirement: Edit save sends manifest/files via updateSkill with the loaded ETag; no ZIP
On save in edit mode, the page SHALL merge the edited `name`/`description` into the *original* frontmatter object loaded at task-load time (unknown fields untouched), serialize that merged object plus the current instructions into `SKILL.md` text (no ZIP rebuild), and SHALL call `updateSkill(bucket, path, skillManifest, filePaths, files, ifMatch: <the ETag loaded at page-load or after the last successful save>)` — `filePaths`/`files` covering every entry in the in-memory supporting-file map (edited entries with their new bytes, untouched entries passed through byte-for-byte). On a successful response, the page SHALL replace its stored ETag with the one DIAL Core returns, so a subsequent save within the same session guards against changes made since *that* save, not the original load.

#### Scenario: Save sends the loaded ETag via updateSkill
- **WHEN** a user saves an edit immediately after a successful load
- **THEN** `updateSkill` is called with `ifMatch` equal to the ETag read from the load response's `ETag` header, and no ZIP is constructed

#### Scenario: ETag advances after a successful save
- **WHEN** a save succeeds and DIAL Core returns a new `ETag`
- **THEN** a second save in the same session sends that new ETag as `ifMatch`, not the original load-time one

#### Scenario: Untouched binary files remain byte-identical
- **WHEN** a user edits only the Description field and saves, without touching a supporting `assets/logo.png` file
- **THEN** the `files` part submitted for `assets/logo.png` is byte-identical to what was originally loaded

### Requirement: Stale edit conflict is explicit and non-destructive
When a save's `updateSkill` call rejects with `412 Precondition Failed` (the ETag sent no longer matches — someone else saved since this page's load), the page SHALL present an explicit conflict state distinct from a generic submit error, offering a "Reload latest" action. The page SHALL NOT automatically retry the save without the user's `If-Match`, and SHALL NOT discard the user's current unsaved field/file edits until the user explicitly confirms discarding them (e.g. by confirming a "Reload latest, discarding my changes" prompt) — reloading is not silently destructive. A `428 Precondition Required` response (the BFF's own guard, should the page ever fail to send `If-Match` — an implementation bug, not an expected runtime state) SHALL be treated the same as any other unrecoverable submit error, distinct from the `412` conflict state.

#### Scenario: 412 shows a conflict state, not a generic error
- **WHEN** `updateSkill` rejects with `412` during an edit save
- **THEN** the page shows an explicit "someone else changed this skill" conflict state with a "Reload latest" action, distinct from the `503`/`413` error states

#### Scenario: Reload latest requires explicit confirmation before discarding edits
- **WHEN** a user activates "Reload latest" while they have unsaved field edits
- **THEN** the page asks for explicit confirmation before replacing the in-progress edits with the freshly reloaded skill; it does not discard them silently

#### Scenario: No silent retry without If-Match
- **WHEN** a `412` occurs
- **THEN** the page does not automatically resubmit the same save with a different or omitted `If-Match`

### Requirement: Resource path and Name are immutable in edit mode
DIAL Core has no rename or move operation for a whole-skill resource. The page SHALL render the Name field read-only in edit mode (via `libs/skill-editor`'s `isNameReadOnly` prop) and SHALL construct the `updateSkill` call's `path` for a save from the *originally loaded* path, never from a (disabled, but defensively re-derived) edited name. The page SHALL NOT implement a rename by creating a new skill at a different path and deleting the old one.

#### Scenario: Name field is read-only in edit mode
- **WHEN** a user opens `/skill-editor?id=...` for an existing skill
- **THEN** the Name field renders read-only and the save path is the originally loaded path regardless of any attempted edit

#### Scenario: No create-then-delete rename path exists
- **WHEN** the codebase is searched for any code path that calls `createSkill` at a new path and `deleteSkill` at the old path within the same user action
- **THEN** none is found

### Requirement: Dirty-navigation guard
When the edit or create form has unsaved changes (`onDirtyChange(true)` most recently reported by `libs/skill-editor`), the page SHALL confirm before: activating Cancel, activating the page's Back control, or closing/navigating away from the browser tab via `beforeunload`. A confirmed navigation proceeds; a declined one leaves the user on the page with their edits intact. No in-app router-level navigation-blocking mechanism (e.g. intercepting arbitrary link/menu clicks elsewhere in the app) is in scope — no such pattern exists elsewhere in this codebase to extend, and this guard is scoped to the page's own Cancel/Back controls plus the browser-level `beforeunload` guard.

#### Scenario: Cancel with unsaved changes confirms first
- **WHEN** a user has unsaved edits and activates Cancel
- **THEN** the page asks for confirmation before navigating to `returnUrl`; declining leaves the edits intact

#### Scenario: Cancel with no unsaved changes navigates immediately
- **WHEN** a user has made no edits (or has reverted to the seeded state) and activates Cancel
- **THEN** the page navigates immediately, with no confirmation prompt

### Requirement: Edit-specific labels and success notification
In edit mode, the page SHALL render an edit-specific title and Save-button label (distinct from create mode's "Create skill" title and Create button) and, on a successful save, SHALL show a success notification distinct from the create-success notification (e.g. "Skill updated" vs. "Skill created").

#### Scenario: Edit mode shows Save, not Create
- **WHEN** the page renders in edit mode
- **THEN** the primary submit button reads a Save-oriented label, and the page title reflects editing an existing skill

#### Scenario: Successful edit save shows an update notification
- **WHEN** an edit save succeeds
- **THEN** the shown notification's copy reflects an update, not a creation

### Requirement: Selecting a supporting file in edit mode opens its preview

In edit mode, selecting a supporting-file node in the file tree (any node other than `SKILL.md`) SHALL open a preview of that file's already-unpacked in-memory bytes (from the edit-mode ZIP unpack described in "Frontmatter and supporting files are unpacked and preserved for editing") through the `skill-file-preview` capability. This SHALL NOT trigger any additional `downloadSkill` call or other network request — the bytes are already resident in the page's `Map<relativePath, Uint8Array>` from the initial load. Selecting `SKILL.md` SHALL continue to show the editable manifest form exactly as today, closing any open supporting-file preview.

#### Scenario: Selecting an unpacked supporting file previews it with no extra download
- **WHEN** an edit-mode session has loaded a skill whose ZIP contained `assets/logo.png`, and a user selects that node
- **THEN** the preview renders `assets/logo.png` from the already-unpacked bytes, with no additional network request beyond the original `downloadSkill` call

#### Scenario: Selecting SKILL.md after previewing a file returns to the manifest form
- **WHEN** a user has a supporting file previewed and then selects the `SKILL.md` node
- **THEN** the preview closes and the editable Name/Description/Instructions form renders as it did before any file was previewed

### Requirement: Edit mode applies the same batch validation limits as create mode

In edit mode, the `SkillEditor` page's `fileActions.validateBatch` implementation SHALL apply the identical per-candidate and batch-level checks specified by `skill-authoring`'s "Batch validation mirrors BFF package limits before commit" requirement (per-file size, path safety/traversal, within-batch and against-existing duplicates, reserved paths, projected total size, projected total file count), computed against the edit session's currently loaded supporting files (the in-memory `Map<relativePath, Uint8Array>` populated at load) rather than a freshly empty set.

#### Scenario: Duplicate against an already-loaded file is rejected
- **WHEN** a user stages a file whose path matches a supporting file already loaded from the edited skill's archive
- **THEN** that candidate is marked invalid with a duplicate error

#### Scenario: Projected total size accounts for already-loaded bytes
- **WHEN** the edited skill already has supporting files near the total package size limit and a user stages a further large file
- **THEN** the projected total size calculation includes the already-loaded bytes, and the batch is rejected if the limit would be exceeded

### Requirement: Importing SKILL.md in edit mode requires an exact name match and explicit confirmation

When the staged batch in edit mode contains a valid manifest candidate (per `skill-authoring`'s manifest-recognition rule), the page SHALL always ask for explicit confirmation before replacing the current manifest fields, regardless of whether the form is currently dirty — unlike create mode, where confirmation is only required when dirty. Because DIAL Core has no rename or move operation for a whole-skill resource, the page SHALL compare the imported manifest's `name` against the current, read-only Skill name (the one originally loaded, immutable per the existing "Resource path and Name are immutable in edit mode" requirement) and SHALL reject the import with a specific commit error if they differ, without changing any field or committing any other staged candidate in the same batch. When the names match, confirming the import SHALL update Description, Instructions, and the preserved frontmatter object (merging into the originally loaded frontmatter, keeping unknown fields untouched, consistent with the existing frontmatter-preservation requirement), while leaving Name and the skill's resource path exactly as loaded.

#### Scenario: Matching-name import asks for confirmation and updates fields
- **WHEN** a user imports a `SKILL.md` whose `name` equals the currently loaded, read-only Skill name
- **THEN** the page asks for explicit confirmation before applying it; on confirmation, Description and Instructions update from the import and Name remains unchanged

#### Scenario: Mismatched-name import is rejected without changing anything
- **WHEN** a user imports a `SKILL.md` whose `name` differs from the currently loaded Skill name
- **THEN** the commit fails with a specific error explaining that renaming isn't supported, and no field, frontmatter, or other staged candidate in the batch is committed

#### Scenario: Confirmation is required even when the form has no unsaved edits
- **WHEN** a user imports a matching-name `SKILL.md` while the edit form has no unsaved changes
- **THEN** the page still asks for explicit confirmation before replacing Description/Instructions/frontmatter

#### Scenario: Unknown frontmatter fields survive a confirmed import
- **WHEN** the originally loaded skill had a `version: "2.0.0"` field and the imported `SKILL.md` omits it
- **THEN** the merged frontmatter used for the next save still includes `version: "2.0.0"`, since the import merges into the original frontmatter rather than replacing it wholesale
