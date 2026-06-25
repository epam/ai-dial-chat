## ADDED Requirements

### Requirement: Conflict resolution popup for upload name collisions
The system SHALL display a conflict resolution popup when one or more files being uploaded have the same name (case-insensitive, after sanitization) as an existing file in the destination folder. The popup SHALL present the following options:

- **Single file conflict**: Radio buttons — Replace / Duplicate.
- **Multiple file conflicts**: Strategy choice — Replace all / Duplicate all / Decide for each (grid with per-file dropdowns).
- **Cancel**: Close the popup without uploading the conflicting files. Non-conflicting files in the same batch SHALL proceed.

The popup is the ui-kit's built-in `ConflictResolutionPopup` wired via `conflictResolutionPopupOptions` on `DialFileManager`. No custom conflict modal SHALL be built in the application layer.

`DialFileManagerModal` MUST pass `conflictResolutionPopupOptions` to `DialFileManager`. The hook `useDialFileManager.onValidateUpload` MUST NOT return `{ valid: false }` for name-collision-only cases — name collisions SHALL be delegated to the ui-kit's internal conflict detection.

**Replace behavior:** The ui-kit calls `onUploadFiles` with the conflicting file's original name. `useDialFileManager` SHALL detect that this name exists in the cached listing and upload with `uploadMode: 'overwrite'` (no `If-None-Match` header on the BFF call → DIAL Core overwrites).

**Duplicate behavior:** The ui-kit generates a unique sibling name (e.g., `notes (1).txt`) and calls `onUploadFiles` with the new name. `useDialFileManager` SHALL detect that this name is absent from the cached listing and upload with `uploadMode: 'create-only'` (`If-None-Match: *` forwarded by the BFF → DIAL Core creates only if the path is free).

**Cancel behavior:** The ui-kit does not call `onUploadFiles` for cancelled files. Non-conflicting files in the same batch upload normally.

**Decide for each:** Per-file decisions (Replace/Duplicate/Cancel) are resolved by the ui-kit, which calls `onUploadFiles` with the final resolved file list. The same overwrite/create-only logic applies per file.

**State ownership:** `useDialFileManager` owns upload state. No new Context is introduced.

**i18n keys:**
| Key | English |
|---|---|
| `dialFileManager.conflictSingleTitle` | `"Replace or Duplicate Item"` |
| `dialFileManager.conflictMultipleTitle` | `"Replace or Duplicate Items"` |
| `dialFileManager.conflictReplace` | `"Replace"` |
| `dialFileManager.conflictDuplicate` | `"Duplicate"` |
| `dialFileManager.conflictDecideForEach` | `"Decide for each"` |
| `dialFileManager.conflictReplaceAll` | `"Replace all"` |
| `dialFileManager.conflictDuplicateAll` | `"Duplicate all"` |
| `buttons.confirm` | `"Confirm"` (reuse existing) |
| `buttons.cancel` | `"Cancel"` (reuse existing) |

**RTL impact:** The conflict popup uses the ui-kit's logical layout — no directional Tailwind classes are added at the app level. No physical-direction classes added.

**Feature flag:** Not gated.

**Memoisation:** `conflictResolutionPopupOptions` SHALL be wrapped in `useMemo` in `DialFileManagerModal` to prevent `DialFileManager` re-renders.

**Accessibility:** Focus is trapped inside `ConflictResolutionPopup` (ui-kit built-in). No additional ARIA needed at the app layer.

**Observability:** None required.

#### Scenario: Single file conflict — user chooses Replace
- **WHEN** the user uploads `notes.txt` and `notes.txt` already exists in the folder
- **THEN** the conflict popup opens with a single-file Replace / Duplicate choice
- **AND** the user selects Replace and confirms
- **AND** `onUploadFiles` is called with `[{ name: 'notes.txt', fileContent: File }]`
- **AND** `useDialFileManager` detects `notes.txt` in the cached listing → uploads with `uploadMode: 'overwrite'`
- **AND** `POST /api/v1/files` is called with `uploadMode: 'overwrite'` → no `If-None-Match` header forwarded to DIAL Core
- **AND** DIAL Core overwrites the existing file
- **AND** after the batch settles the folder listing is refreshed

#### Scenario: Single file conflict — user chooses Duplicate
- **WHEN** the user uploads `notes.txt` and `notes.txt` already exists in the folder
- **THEN** the conflict popup opens
- **AND** the user selects Duplicate and confirms
- **AND** the ui-kit generates a unique name (e.g., `notes (1).txt`) and calls `onUploadFiles` with the new name
- **AND** `useDialFileManager` detects `notes (1).txt` is absent from the cached listing → uploads with `uploadMode: 'create-only'`
- **AND** `POST /api/v1/files` is called with `uploadMode: 'create-only'` → BFF forwards `If-None-Match: *` to DIAL Core
- **AND** DIAL Core creates `notes (1).txt` without overwriting the original `notes.txt`
- **AND** after the batch settles the folder listing shows both `notes.txt` and `notes (1).txt`

#### Scenario: Single file conflict — user cancels
- **WHEN** the user uploads `notes.txt` and `notes.txt` already exists
- **THEN** the conflict popup opens
- **AND** the user clicks Cancel
- **AND** the popup closes; no upload request is made for `notes.txt`

#### Scenario: Multiple file conflicts — Replace all
- **WHEN** the user uploads 3 files and all 3 already exist in the folder
- **THEN** the multi-file conflict popup opens with Replace all / Duplicate all / Decide for each
- **AND** the user selects Replace all and confirms
- **AND** all 3 files are uploaded with `uploadMode: 'overwrite'`

#### Scenario: Multiple file conflicts — Decide for each
- **WHEN** the user uploads 3 conflicting files and chooses Decide for each
- **THEN** the popup shows a grid with per-file dropdowns (Replace / Duplicate / Cancel)
- **AND** the user selects Replace for file 1, Duplicate for file 2, Cancel for file 3
- **AND** file 1 uploads with `uploadMode: 'overwrite'`; file 2 uploads with the generated suffix name and `uploadMode: 'create-only'`; file 3 is skipped
- **AND** two upload requests are made; the folder listing refreshes showing the updated and new files

#### Scenario: Mixed batch — some conflict, some don't
- **WHEN** the user uploads 5 files: 2 conflict, 3 don't
- **THEN** the conflict popup shows only the 2 conflicting files
- **AND** regardless of the user's choice for the conflicting files, the 3 non-conflicting files are uploaded immediately
- **AND** the conflicting files are uploaded after the popup is resolved

#### Scenario: Duplicate race condition
- **WHEN** two browser tabs simultaneously upload a file named `report.txt` and both choose Duplicate → both get `report (1).txt`
- **THEN** the first tab's request to `POST /api/v1/files` with `uploadMode: 'create-only'` succeeds (DIAL Core creates `report (1).txt`)
- **AND** the second tab's request returns 412 from DIAL Core → BFF maps to 409 Conflict → `report (1).txt` entry shows `Failed` status in the progress modal
- **AND** the first tab's `report (1).txt` is preserved; no silent overwrite occurs
