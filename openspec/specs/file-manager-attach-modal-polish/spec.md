# file-manager-attach-modal-polish Specification

## Purpose

Attach-modal refinements: auto-selecting uploaded items, tab-specific empty states, and capping file-name byte length.

## ADDED Requirements

### Requirement: autoSelectUploadedItems adds uploaded paths to selectedPaths

`DialFileManagerModal` SHALL accept an `autoSelectUploadedItems?: boolean` prop (default `true`). When `true`, after the current upload batch reaches `status: 'done'` (as tracked by `uploadBatchState` from `useDialFileManager`), the modal SHALL add the successfully uploaded file paths to `selectedPaths` using `setSelectedPaths`.

The selection update SHALL use `Set` deduplication to avoid double-entries if the same file is uploaded twice within a session.

When `autoSelectUploadedItems` is `false`, `selectedPaths` SHALL NOT be modified automatically after upload; behavior is identical to current (no auto-select).

State ownership: `DialFileManagerModal` — existing `selectedPaths` state; effect triggered by `uploadBatchState`.
Feature flag: none — controlled by the prop.
RTL: none.
Memoisation: the `useEffect` dependency array MUST include `uploadBatchState.status` and `autoSelectUploadedItems`.

#### Scenario: Uploaded files auto-selected when prop is true

- **WHEN** `autoSelectUploadedItems={true}` and an upload batch completes with two files
- **THEN** both uploaded file paths appear in `selectedPaths`

#### Scenario: Previously selected paths preserved after upload

- **WHEN** user had already selected `file_a.pdf` and then uploads `file_b.png` with `autoSelectUploadedItems={true}`
- **THEN** `selectedPaths` contains both `file_a.pdf` and `file_b.png`

#### Scenario: No auto-select when prop is false

- **WHEN** `autoSelectUploadedItems={false}` and an upload batch completes
- **THEN** `selectedPaths` is unchanged

#### Scenario: Duplicate upload does not double-add path

- **WHEN** `file_a.pdf` is already in `selectedPaths` and user uploads `file_a.pdf` again (replace mode)
- **THEN** `selectedPaths` contains `file_a.pdf` exactly once

---

### Requirement: Tab-specific empty state copy

`DialFileManagerShell` SHALL pass tab-specific `emptyStateTitle` and `emptyStateDescription` to `DialFileManager` based on the active tab. Each tab SHALL use distinct i18n keys.

i18n keys:
- My Files: `dialFileManager.myFiles.emptyStateTitle`, `dialFileManager.myFiles.emptyStateDescription`
- Shared: `dialFileManager.shared.emptyStateTitle`, `dialFileManager.shared.emptyStateDescription`
- Organization: `dialFileManager.organization.emptyStateTitle`, `dialFileManager.organization.emptyStateDescription`

All six keys SHALL be added to `apps/chat/src/i18n/locales/en.json` and to `DialFileManagerI18nKeys`.

RTL: none — text direction is inherited from the `dir` attribute on `<html>`.
Memoisation: empty state props in `useMemo` keyed on active tab.

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

`apps/chat/src/utils/file.ts` SHALL export `trimFileNameToByteLimit(name: string, limit = 255): string`. The function SHALL measure the UTF-8 byte length of `name` using `TextEncoder`. If the byte length exceeds `limit`, it SHALL trim on a character boundary (not a byte boundary) such that the result's UTF-8 byte length is ≤ `limit`, preserving the file extension.

`sanitizeFileName` SHALL apply `trimFileNameToByteLimit` as its final step.

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
