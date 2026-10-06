# Spec: File Manager Filename Sanitization

## Purpose

Sanitizing an upload's filename before conflict detection runs.

## Requirements

### Requirement: Sanitize upload filename before conflict detection
The system SHALL sanitize each uploaded file's name by replacing any character matching `NOT_ALLOWED_SYMBOLS_REGEXP` (from `@epam/ai-dial-ui-kit`) with `_`, trimming trailing dots and whitespace from the base name, and preserving the original file extension. Sanitization SHALL occur inside `onValidateUpload` (built by `useDialFileUploadBatch` in `libs/chat-hooks/src/files/useDialFileUploadBatch/useDialFileUploadBatch.ts` and returned through `useDialFileManager`), mutating `DialUploadFileItem.name` in-place before the ui-kit performs conflict detection. The sanitized name SHALL be used for all subsequent operations including conflict popup display, upload path construction, and `POST /api/v1/files`.

Sanitization logic SHALL live in `libs/chat-hooks/src/files/file-name.ts` as `sanitizeFileName(name: string): string`, exported from `@epam/ai-dial-chat-hooks` (also reused by `useAttachmentUpload` and the app's `useCatalogItemActions`):
- Split name at the last `.` (`splitFileNameExtension`; a leading dot is not an extension) to isolate base name and extension.
- Apply `NOT_ALLOWED_SYMBOLS_REGEXP` globally, replacing each match with `_`.
- Trim trailing dots and whitespace from the base name.
- Re-attach the extension unchanged.
- If the resulting base name is empty after trimming, return the original (unsanitized) name unchanged.
- Otherwise cap the result to 255 UTF-8 bytes with `trimFileNameToByteLimit`, truncating the base name and keeping the extension.

`NOT_ALLOWED_SYMBOLS_REGEXP` MUST be imported from `@epam/ai-dial-ui-kit` — the symbol list SHALL NOT be duplicated.

The `forbiddenSymbolsRegExp={NOT_ALLOWED_SYMBOLS_REGEXP}` prop MUST be passed to `DialFileManager` in `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) for consistent rename / create-folder validation UX.

**State ownership:** No new state. Sanitization is a pure transformation applied in `onValidateUpload`.

**i18n keys:**
| Key | English |
|---|---|
| `dialFileManager.forbiddenSymbolsTooltip` | `"File name should not contain special symbols {{notAllowedSymbols}}"` |

**RTL impact:** None — sanitization is text manipulation; no directional UI.

**Feature flag:** Not gated.

**Memoisation:** `sanitizeFileName` is a pure function — no memoisation required. `onValidateUpload` is already wrapped in `useCallback`.

**Accessibility:** No new UI surface. `forbiddenSymbolsTooltip` is rendered by the ui-kit on rename/create inputs.

**Observability:** None required.

#### Scenario: Filename with forbidden characters is sanitized
- **WHEN** the user selects a file named `my:report;2026.pdf`
- **THEN** `sanitizeFileName('my:report;2026.pdf')` returns `'my_report_2026.pdf'`
- **AND** `DialUploadFileItem.name` is mutated to `'my_report_2026.pdf'` before conflict detection
- **AND** `POST /api/v1/files` is called with `path: '<folder>/my_report_2026.pdf'`

#### Scenario: Filename with trailing dot in base name
- **WHEN** the user selects a file named `archive..tar`
- **THEN** `sanitizeFileName('archive..tar')` returns `'archive.tar'`
- **AND** the trailing dot on the base name `archive.` is trimmed while the `.tar` extension is kept

#### Scenario: Filename with no forbidden characters is unchanged
- **WHEN** the user selects a file named `report_2026-Q1.pdf`
- **THEN** `sanitizeFileName('report_2026-Q1.pdf')` returns `'report_2026-Q1.pdf'` unchanged

#### Scenario: Extension is preserved
- **WHEN** the user selects a file named `data:export.csv`
- **THEN** `sanitizeFileName('data:export.csv')` returns `'data_export.csv'`
- **AND** the `.csv` extension is preserved exactly

#### Scenario: File with no extension
- **WHEN** the user selects a file named `README:`
- **THEN** `sanitizeFileName('README:')` returns `'README_'`

#### Scenario: Sanitized name collides with existing file
- **WHEN** the user selects `my:notes.txt` and `my_notes.txt` already exists in the folder
- **THEN** `onValidateUpload` sanitizes to `my_notes.txt` before returning
- **AND** the ui-kit's conflict detection sees `my_notes.txt` vs the existing `my_notes.txt` → opens the conflict popup
- **AND** the user must choose Replace or Duplicate; no silent overwrite occurs

#### Scenario: forbiddenSymbolsRegExp shown in rename tooltip
- **WHEN** the user attempts to rename a file to a name containing a forbidden symbol
- **THEN** the ui-kit's rename input shows the `dialFileManager.forbiddenSymbolsTooltip` message
