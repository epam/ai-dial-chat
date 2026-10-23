# Spec Delta

## MODIFIED Requirements

### Requirement: Batch validation mirrors BFF package limits before commit

In create mode, the `fileActions.validateBatch` implementation the `SkillEditor` page gets from `useSkillFileActions` (`@epam/ai-dial-chat-hooks`, backed by `validateSkillFileBatch` in `libs/chat-hooks/src/skill/skill-file-batch-validation.ts`) SHALL, for every staged candidate, reject: a per-file size over `SKILL_FILE_UPLOAD_MAX_BYTES` (1 MiB); an invalid or unsafe path per the existing client-side `isValidSkillRelativePath` mirror; a path traversal attempt; a duplicate path within the staged batch itself; a duplicate path against a file already present in the editor's `files` state, unless the candidate carries `replacesExisting: true` (the user chose Replace in the upload dialog); a path equal to an existing folder node, which no candidate may take over; and a reserved root path. A replacing candidate SHALL count once toward the projected file count, and its target's bytes (passed as `existingFileBytes`) SHALL be subtracted from the projected size. At the batch level, it SHALL reject the whole batch if the projected total package size (sum of all already-present supporting-file bytes, all staged supporting-file bytes, and the UTF-8 byte size of the current or imported root `SKILL.md`) would exceed `SKILL_UPLOAD_MAX_TOTAL_BYTES` (16 MiB), or if the projected total file count (already-present supporting files, plus staged supporting files, plus exactly one for the root `SKILL.md`) would exceed `SKILL_UPLOAD_MAX_FILES` (100). These three limit constants SHALL be defined once and imported, not duplicated as inline magic numbers, and SHALL be documented as a client-side mirror of the BFF's authoritative `SkillsPackageService` limits — the BFF remains the final gate.

#### Scenario: Oversized file is rejected per-candidate
- **WHEN** a staged candidate's `File.size` exceeds `SKILL_FILE_UPLOAD_MAX_BYTES`
- **THEN** `validateBatch` marks that candidate invalid with a size-specific error, without reading its bytes

#### Scenario: Projected total size rejects the whole batch
- **WHEN** the sum of existing supporting-file bytes, staged supporting-file bytes, and the manifest's UTF-8 byte size exceeds `SKILL_UPLOAD_MAX_TOTAL_BYTES`
- **THEN** `validateBatch` returns a batch-level error and the batch cannot be committed until it is reduced

#### Scenario: Projected total file count rejects the whole batch
- **WHEN** existing files plus staged files plus the root manifest would exceed `SKILL_UPLOAD_MAX_FILES`
- **THEN** `validateBatch` returns a batch-level error naming the count limit

#### Scenario: Within-batch duplicate paths are both rejected
- **WHEN** two staged candidates resolve to the same path
- **THEN** both are marked invalid with a duplicate-path error, and neither can be committed without first removing one

#### Scenario: A staged path duplicating an existing file is rejected
- **WHEN** a staged candidate's path matches a path already present in the editor's `files` state and the candidate does not carry `replacesExisting: true`
- **THEN** that candidate is marked invalid with a duplicate error; it is not silently treated as a replacement

#### Scenario: An explicit replacement overwrites the existing file
- **WHEN** a staged candidate carries `replacesExisting: true` and its path matches an existing supporting file
- **THEN** `validateBatch` accepts it, the projected totals count that path once and subtract the replaced file's bytes, and `commitBatch` overwrites the file's bytes in `filesContentRef` without adding a second node and bumps that path in `contentRevisions`

#### Scenario: A file never takes over a folder's path
- **WHEN** a staged candidate's path equals an existing folder node's path, with or without `replacesExisting`
- **THEN** `validateBatch` marks it invalid with the duplicate-path error, so the upload cannot vanish into a folder node

### Requirement: HTTP error mapping for `createSkill`
The `SkillEditor` page SHALL interpret `createSkill` failures as follows and render a corresponding inline or notification error, keeping the form's field values intact for retry: `400` → the server's own validation message, shown verbatim when present; `409` → naming conflict (inline Name-field error, offering retry with a different name); `413` → the package is too large (inline `skillEditor.error.archiveTooLarge`, "This skill package is too large to upload."); `503` → service unavailable (inline, alongside a Retry action which resubmits the same in-memory manifest/files without rebuilding anything). Retry is offered only for a failure a plain re-send can clear: the other statuses above name something wrong with the submission itself, and re-sending it unchanged would fail the same way, so they render as text alone.

#### Scenario: 400 shows the server's real message
- **WHEN** `createSkill` rejects with `400` and a message body (e.g. "Skill must contain a SKILL.md at its root")
- **THEN** the page shows that exact message rather than a generic, unrelated one

#### Scenario: 413 response shows a size-specific message
- **WHEN** `createSkill` rejects with `413`
- **THEN** the page shows the inline "This skill package is too large to upload." message, and does not clear the user's field values

#### Scenario: 503 response offers retry without rebuilding anything
- **WHEN** `createSkill` rejects with `503`
- **THEN** the page shows a retry action that resubmits the exact same in-memory manifest/files rather than reconstructing them from current form state

#### Scenario: A file replaced after the failure invalidates the cached payload
- **WHEN** `createSkill` rejects with `503` and the user then replaces a supporting file's bytes before retrying
- **THEN** the retry rebuilds the payload with the new bytes, because `useSkillEditorSubmit` fingerprints `contentRevisions` together with the form values and file paths

### Requirement: Responsive layout — mobile Editing file card, desktop two-pane
At the `desktop` breakpoint, the page SHALL render the shared two-pane layout, with Cancel/Create in the page header:

- **Left panel:** the Files pane.
- **Right panel:** the selected file. For `SKILL.md` that is Name, Description and the Instructions editor.

At the `mobile` breakpoint, the page SHALL render a single scrolling column:

1. The Files pane, inside an "Editing file" card that starts collapsed — the caption, the selected file's type icon and name, and a down caret — and expands in place (caret up) to show the Files heading, the Add menu and the file tree. The card sits 20px above the selected file's heading.
2. The selected file.

At `mobile`, Cancel/Create SHALL render in a bottom action bar (the `EditorLayout` bar from `libs/builder-form`) placed after, and outside, the scrollable body, so it remains reachable at any scroll position. Both breakpoints SHALL keep Back reachable in the page header.

#### Scenario: Desktop shows the two-pane layout
- **WHEN** the viewport is at the `desktop` breakpoint
- **THEN** the Files pane renders on the left, the selected file renders on the right, and Cancel/Create are in the header

#### Scenario: Mobile collapses the Files pane by default
- **WHEN** the viewport is at the `mobile` breakpoint and the page first renders
- **THEN** the "Editing file" summary shows collapsed above the selected file, and Cancel/Create render in the bottom action bar

#### Scenario: Mobile Create remains reachable while scrolled
- **WHEN** a user on `mobile` scrolls to the bottom of the Instructions editor
- **THEN** the Create and Cancel actions remain visible in the bottom action bar without further scrolling

## RENAMED Requirements

- FROM: `### Requirement: Responsive layout — mobile inline accordion, desktop two-pane`
- TO: `### Requirement: Responsive layout — mobile Editing file card, desktop two-pane`
