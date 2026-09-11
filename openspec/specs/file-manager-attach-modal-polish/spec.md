# file-manager-attach-modal-polish Specification

## Purpose

Attach-modal refinements: auto-selecting uploaded items, tab-specific empty states, and capping file-name byte length.

## Requirements

### Requirement: autoSelectUploadedItems auto-selects newly uploaded items

`DialFileManagerModal` SHALL accept an `autoSelectUploadedItems?: boolean` prop (default `true`) and SHALL forward it unchanged through `FileManagerAttachModal` and `DialFileManagerShell` to the ui-kit `DialFileManager`, whose own default is `false`. The host SHALL NOT implement auto-selection itself — the behaviour is owned by the ui-kit `FileManagerProvider`, and the host contract is the prop passthrough plus the `selectedPaths` / `onSelectedPathsChange` pair.

When `true`, the ui-kit records the item names and the destination folder at the moment `onUploadFiles`, `onUploadArchive`, or `onCreateFolder` fires, and applies that pending record once `items` refreshes and the destination folder's children contain the matching names. Auto-selection therefore covers uploaded files, uploaded archives, and newly created folders — not only uploaded files.

The recorded names are the names after `sanitizeFileName`, because `useDialFileUploadBatch` rewrites `DialUploadFileItem.name` inside `onValidateUpload`, which the ui-kit awaits before calling `onUploadFiles`.

Auto-selection SHALL be skipped when either:

- the current path is no longer the upload's destination folder — the pending record is discarded, and a later return to that folder does not revive it; or
- the item fails the ui-kit's `isFileSelectable` check against `allowedFileTypes` / `maxSelectableFileSize`. The host's own `isRowSelectable` predicate is **not** consulted here, so a folder row that the host blocks for selection can still be auto-selected after creation.

`selectedPaths` is a `Set` of paths, so a name uploaded twice into the same folder resolves to a single entry.

When `autoSelectUploadedItems` is `false`, `selectedPaths` SHALL NOT be modified automatically after upload.

**Divergence from the original intent (ui-kit owned):** the ui-kit *replaces* the selection with the matched paths (`setSelectedPaths(matchedPaths)`) instead of merging them into the existing selection, so a row selected before the upload is dropped when auto-selection fires. This requirement originally specified add-and-dedupe; the replace semantics are recorded here as current behaviour, not endorsed. Closing the gap requires a `@epam/ai-dial-ui-kit` change, not a host change.

State ownership: `DialFileManagerModal` owns the `selectedPaths` state; the ui-kit drives every update through `onSelectedPathsChange`, and the host filters hidden paths out of each update before storing it.
Feature flag: none — controlled by the prop.
RTL: none.

#### Scenario: Uploaded files auto-selected when prop is true

- **WHEN** `autoSelectUploadedItems={true}` and an upload of two files into the current folder settles
- **THEN** both uploaded file paths appear in `selectedPaths`

#### Scenario: Newly created folder auto-selected when prop is true

- **WHEN** `autoSelectUploadedItems={true}` and the user creates a folder in the current folder
- **THEN** the new folder's path appears in `selectedPaths`

#### Scenario: Previously selected path is replaced, not preserved

- **WHEN** the user has `file_a.pdf` selected and then uploads `file_b.png` by dropping it on the grid
- **THEN** `selectedPaths` contains `file_b.png` only, and `file_a.pdf` is dropped

#### Scenario: New toolbar is unavailable while a selection is active

- **WHEN** at least one row is selected
- **THEN** the ui-kit renders the bulk-actions toolbar in place of the New toolbar, so drag & drop onto the grid is the only route to starting an upload while a selection exists

#### Scenario: Pending auto-selection discarded after navigating away

- **WHEN** an upload into `folder_a` settles after the user has navigated to `folder_b`
- **THEN** the pending record is discarded and `selectedPaths` is unchanged

#### Scenario: Uploaded file rejected by the type filter is not selected

- **WHEN** `allowedFileTypes` excludes the uploaded file's type
- **THEN** the file is listed but its path is not added to `selectedPaths`

#### Scenario: No auto-select when prop is false

- **WHEN** `autoSelectUploadedItems={false}` and an upload settles
- **THEN** `selectedPaths` is unchanged

#### Scenario: Same name uploaded twice yields one entry

- **WHEN** `file_a.pdf` is uploaded again into the folder that already holds it (replace mode)
- **THEN** `selectedPaths` contains `file_a.pdf` exactly once

---

### Requirement: Tab-specific empty state copy

`DialFileManagerShell` SHALL pass tab-specific `emptyStateTitle` and `emptyStateDescription` to `DialFileManager` based on the active tab. Each tab SHALL use distinct i18n keys.

i18n keys:
- My Files: `dialFileManager.myFiles.emptyStateTitle`, `dialFileManager.myFiles.emptyStateDescription`
- Shared: `dialFileManager.shared.emptyStateTitle`, `dialFileManager.shared.emptyStateDescription`
- Organization: `dialFileManager.organization.emptyStateTitle`, `dialFileManager.organization.emptyStateDescription`

All six keys SHALL be added to `apps/chat/src/i18n/locales/en.json` and to `DialFileManagerI18nKeys`.

Two contexts SHALL override the tab-specific copy, in this precedence order:

1. a settled search with no matches → `labels.searchEmptyStateTitle`;
2. an empty subfolder (a path more than one segment deep) → `labels.folderEmptyStateTitle`.

Both overrides render an empty description; the tab-specific copy is used only at a tab's root with no active search.

RTL: none — text direction is inherited from the `dir` attribute on `<html>`.
Memoisation: empty state props in `useMemo` keyed on the active tab, the search state, and the current path.

#### Scenario: My Files empty state shown when My Files tab is empty

- **WHEN** the My Files tab is active and the folder contains no items
- **THEN** the empty state displays the value of `dialFileManager.myFiles.emptyStateTitle`

#### Scenario: Shared empty state shown when Shared tab is empty

- **WHEN** the Shared tab is active and no shared files exist
- **THEN** the empty state displays the value of `dialFileManager.shared.emptyStateTitle`

#### Scenario: Organization empty state shown when Organization tab is empty

- **WHEN** the Organization tab is active and no organization files exist
- **THEN** the empty state displays the value of `dialFileManager.organization.emptyStateTitle`

---

### Requirement: trimFileNameToByteLimit caps file name byte length on upload

`libs/chat-hooks/src/files/file-name.ts` SHALL export `trimFileNameToByteLimit(name: string, limit = 255): string`, re-exported from `@epam/ai-dial-chat-hooks`. The function SHALL measure the UTF-8 byte length of `name` via `getUtf8ByteLength` from `@epam/ai-dial-chat-shared`. If the byte length exceeds `limit`, it SHALL trim on a character boundary (not a byte boundary) using `truncateToUtf8Bytes` such that the result's UTF-8 byte length is ≤ `limit`, preserving the file extension. When the extension alone consumes the whole limit, the full name is truncated instead.

`sanitizeFileName` SHALL apply `trimFileNameToByteLimit` as its final step, and SHALL return the original name unchanged when the base name is empty after sanitization. `useDialFileUploadBatch` SHALL apply `sanitizeFileName` to each `DialUploadFileItem.name` during upload validation, so the ui-kit's conflict detection and the auto-selection record both see the sanitized name.

RTL: none — utility is direction-agnostic.
Feature flag: none.

#### Scenario: Short name is unchanged

- **WHEN** `trimFileNameToByteLimit('report.pdf', 255)` is called
- **THEN** `'report.pdf'` is returned unchanged

#### Scenario: Long ASCII name is trimmed to byte limit

- **WHEN** name is 300 ASCII characters with extension `.txt`
- **THEN** returned name has UTF-8 byte length ≤ 255 and ends with `.txt`

#### Scenario: CJK filename trimmed on character boundary

- **WHEN** name consists of 100 CJK characters (3 bytes each = 300 bytes) with extension `.docx`
- **THEN** returned name has UTF-8 byte length ≤ 255, ends with `.docx`, and contains no partial multi-byte sequence

#### Scenario: Emoji filename trimmed on character boundary

- **WHEN** name consists of emoji characters (4 bytes each) and total exceeds 255 bytes
- **THEN** returned name has UTF-8 byte length ≤ 255 with no split surrogate pair
