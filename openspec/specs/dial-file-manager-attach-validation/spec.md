## ADDED Requirements

### Requirement: Hidden-path rows are not selectable

`DialFileManagerModal` SHALL prevent selection of any grid row whose `path` contains `.dial_folder` (including files inside hidden folders). The `isRowSelectable` predicate SHALL return `false` for such rows.

A utility function `isHiddenPath(path: string): boolean` SHALL be created in `apps/chat/src/utils/file-path.ts` (or an existing app-level file-path utility) using the `HIDDEN_FILE` constant from `@epam/ai-dial-chat-shared`. This helper MUST NOT be placed inside any `libs/*` package.

i18n: tooltip key `DialFileManager.AttachingHiddenFilesNotAllowed`
RTL: none (tooltip text only)
Feature flag: none
Memoisation: `isRowSelectable` is already inside `useMemo`-wrapped `gridOptions`; no additional memoisation needed.

#### Scenario: Hidden marker file is not selectable

- **WHEN** a row with `path` containing `.dial_folder` is rendered in the grid
- **THEN** `isRowSelectable` returns `false` for that row and the checkbox is not rendered / is disabled

#### Scenario: File inside a hidden folder is not selectable

- **WHEN** a file row has a `path` like `files/bucket/.dial_folder/child.txt`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: Normal file is still selectable

- **WHEN** a file row has a `path` that does not contain `.dial_folder`
- **THEN** `isRowSelectable` returns `true` for that row (subject to MIME and size rules)

---

### Requirement: MIME-type filtering in grid selection

When `allowedTypes` is provided and non-empty, `DialFileManagerModal` SHALL prevent selection of file rows whose `contentType` does not match any entry in `allowedTypes`.

Matching SHALL use `isMimeTypeAllowed(contentType, allowedTypes)` from `apps/chat/src/utils/attachment-mime.ts`. Wildcard (`image/*`, `*/*`) matching MUST be supported.

When `allowedTypes` is empty or absent, all MIME types are allowed (no restriction).

MIME filtering applies to `DialFileNodeType.ITEM` rows only; `FOLDER` rows are unaffected by this rule.

RTL: none
Feature flag: none
Memoisation: `isRowSelectable` inside `useMemo`-wrapped `gridOptions`

#### Scenario: File with disallowed MIME type is not selectable

- **WHEN** `allowedTypes` is `['image/*']` and a row has `contentType: 'application/pdf'`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: File with allowed MIME type is selectable

- **WHEN** `allowedTypes` is `['image/*']` and a row has `contentType: 'image/jpeg'`
- **THEN** `isRowSelectable` returns `true` (subject to hidden and size rules)

#### Scenario: No restriction when allowedTypes is empty

- **WHEN** `allowedTypes` is `[]` or not provided
- **THEN** all file rows are selectable regardless of content type

#### Scenario: Wildcard allows all subtypes

- **WHEN** `allowedTypes` is `['*/*']` and a row has any `contentType`
- **THEN** `isRowSelectable` returns `true`

---

### Requirement: File-size cap in grid selection

When `maxSelectableFileSize` is provided (in bytes), `DialFileManagerModal` SHALL prevent selection of file rows whose `contentLength` exceeds that value.

When `maxSelectableFileSize` is absent or `undefined`, no size restriction is applied.

File-size checking applies to `DialFileNodeType.ITEM` rows only. Folder rows are unaffected.

RTL: none
Feature flag: none
Memoisation: same `isRowSelectable` in `useMemo` grid options

#### Scenario: File exceeding size cap is not selectable

- **WHEN** `maxSelectableFileSize` is `5_000_000` and a row has `contentLength: 6_000_000`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: File at exactly the size cap is selectable

- **WHEN** `maxSelectableFileSize` is `5_000_000` and a row has `contentLength: 5_000_000`
- **THEN** `isRowSelectable` returns `true`

#### Scenario: No restriction when maxSelectableFileSize is absent

- **WHEN** `maxSelectableFileSize` is `undefined`
- **THEN** no row is excluded based on size

---

### Requirement: Attach handler skips hidden and MIME-invalid files with info toast

When the user clicks Attach, `DialFileManagerModal` SHALL:
1. Remove from the resolved set any selected file that is hidden (`isHiddenPath`) or has a disallowed MIME type (when `allowedTypes` is provided).
2. If any files were removed due to unsupported type, show an info notification (title: `DialFileManager.UnsupportedFilesSkipped`, message: `DialFileManager.UnsupportedFilesDescription`).
3. Call `onAttach` with the filtered set (modal closes).

Hidden files removed at the grid level (non-selectable) are not expected to appear in `selectedFiles`, but the Attach handler SHALL apply the hidden check again as a safety net.

i18n keys: `DialFileManager.UnsupportedFilesSkipped`, `DialFileManager.UnsupportedFilesDescription`
RTL: none (toast only)
Feature flag: none
Memoisation: `handleAttach` in `useCallback`

#### Scenario: Unsupported-type files are skipped silently with info toast

- **WHEN** user has selected 3 files, 1 has a disallowed MIME type, and clicks Attach
- **THEN** `onAttach` is called with the 2 valid files and an info toast is shown

#### Scenario: No toast when all selected files are valid

- **WHEN** user has selected files all with allowed MIME types and clicks Attach
- **THEN** `onAttach` is called with all selected files and no toast is shown

#### Scenario: Modal closes after attach even when files were filtered

- **WHEN** the Attach handler filters some files and calls `onAttach`
- **THEN** the modal closes

---

### Requirement: Attach handler blocks when count exceeds maximumAttachmentsAmount

When `maximumAttachmentsAmount` is provided and greater than `0`, `DialFileManagerModal` SHALL check the count of the valid (post-filter) selection **after** applying hidden and MIME filters. If the count exceeds `maximumAttachmentsAmount`, the modal SHALL:
1. Show an error notification (title: `DialFileManager.TooManyFilesSelected`, message: `DialFileManager.TooManyFilesDescription` with `{{count}}` and `{{limit}}`).
2. **Not** call `onAttach` — the modal stays open.

i18n keys: `DialFileManager.TooManyFilesSelected`, `DialFileManager.TooManyFilesDescription` (params: `count`, `limit`)
RTL: none (toast only)
Feature flag: none
Memoisation: `handleAttach` in `useCallback`

#### Scenario: Too many files — modal stays open, error toast shown

- **WHEN** `maximumAttachmentsAmount` is `3`, user selects 5 valid files, and clicks Attach
- **THEN** an error toast is shown with count=5, limit=3, and `onAttach` is NOT called

#### Scenario: Count at limit — attach succeeds

- **WHEN** `maximumAttachmentsAmount` is `3` and user selects exactly 3 valid files
- **THEN** `onAttach` is called with 3 files and the modal closes

#### Scenario: No count restriction when maximumAttachmentsAmount is absent

- **WHEN** `maximumAttachmentsAmount` is `undefined` or `0`
- **THEN** any count of valid files is accepted

#### Scenario: Count check applied after MIME filter

- **WHEN** `maximumAttachmentsAmount` is `2` and user selects 3 files (1 invalid MIME)
- **THEN** the post-filter count is 2 which equals the limit, so `onAttach` is called and the modal closes
