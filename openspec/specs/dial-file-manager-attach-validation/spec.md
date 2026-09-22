## Purpose

Define how the DIAL file manager attach modal validates selectable rows and the final attach payload before files are added to a chat message.

## Requirements

### Requirement: Hidden-path rows are not selectable

`DialFileManagerModal` SHALL prevent selection of any grid row whose `path` contains a hidden path segment. A segment is hidden when it starts with `.` (for example `.env`, `.hidden`, or the file-manager placeholder `.dial_folder`). This includes files inside hidden folders. The `isRowSelectable` predicate SHALL return `false` for such rows.

The canonical `isHiddenPath(path: string): boolean` SHALL be owned by `@epam/ai-dial-chat-shared` and evaluate path segments rather than relying on a single marker string. The reusable attachment picker and shared modal SHALL consume this helper without an app-local duplicate.

i18n: tooltip key `DialFileManager.AttachingHiddenFilesNotAllowed`
RTL: none (tooltip text only)
Feature flag: none
Memoisation: the reusable picker SHALL expose a memoized `isRowSelectable` predicate that updates when its constraints change.

#### Scenario: Dot-prefixed hidden file is not selectable

- **WHEN** a row with `path` containing a dot-prefixed segment such as `/My files/.env` is rendered in the grid
- **THEN** `isRowSelectable` returns `false` for that row and the checkbox is not rendered / is disabled

#### Scenario: File inside a hidden folder is not selectable

- **WHEN** a file row has a `path` like `/My files/.hidden/child.txt`
- **THEN** `isRowSelectable` returns `false` for that row

#### Scenario: Normal file is still selectable

- **WHEN** a file row has a `path` with no dot-prefixed segments
- **THEN** `isRowSelectable` returns `true` for that row (subject to MIME and size rules)

---

### Requirement: MIME-type filtering in grid selection

When `allowedTypes` is provided and non-empty, `DialFileManagerModal` SHALL prevent selection of file rows whose `contentType` does not match any entry in `allowedTypes`.

Matching SHALL use the canonical `isMimeTypeAllowed(contentType, allowedTypes)` from `@epam/ai-dial-attachment-input`, consumed directly by the reusable attachment picker. Wildcard (`image/*`, `*/*`) matching MUST be supported.

When `allowedTypes` is empty or absent, all MIME types are allowed (no restriction).

MIME filtering applies to `DialFileNodeType.ITEM` rows only; `FOLDER` rows are unaffected by this rule.

RTL: none
Feature flag: none
Memoisation: the reusable picker SHALL expose a memoized `isRowSelectable` predicate that updates when its constraints change.

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

`maxSelectableFileSize` SHALL be sourced from `useAppConfig().config.maxAttachmentFileSizeBytes` rather than the hardcoded `MAX_SELECTABLE_FILE_SIZE_BYTES` constant (`apps/chat/src/constants/files.ts`). The constant is retained only as `AppConfigContext`'s pre-load default value (see `app-config-context`'s `maxAttachmentFileSizeBytes` requirement) — no caller of `DialFileManagerModal` SHALL reference the constant directly any longer.

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

#### Scenario: The limit tracks the AppConfig value, not the old constant

- **WHEN** an operator sets `FILE_UPLOAD_MAX_BYTES` to a value other than 512 MB
- **THEN** `DialFileManagerModal`'s `maxSelectableFileSize` reflects that operator-configured value (via `useAppConfig().config.maxAttachmentFileSizeBytes`), not the hardcoded `536_870_912` constant

---

### Requirement: New-upload size cap uses the ui-kit's native maxFileSize check

`DialFileManagerModal` SHALL pass the same `maxSelectableFileSize` value into `FileManagerAttachModal`'s (and, through it, `DialFileManagerShell`'s) `maxFileSize` prop on `<DialFileManager>` from `@epam/ai-dial-react-file-manager` — the vendor component's own built-in pre-upload size check, distinct from `maxSelectableFileSize`'s existing-file-selection check. `DialFileManagerModal` SHALL also pass a translated `oversizedUploadMessage` string (new prop on `FileManagerAttachModal`/`DialFileManagerShell`), forwarded to `<DialFileManager>`'s `uploadValidationMessages.oversizedFiles`.

This is a single AppConfig-sourced numeric value doing double duty: it bounds which already-listed files are selectable (`maxSelectableFileSize` → `isRowSelectable`) and, via the same value forwarded as `maxFileSize`, which freshly-picked local files the ui-kit accepts into an upload batch at all. `onValidateUpload`/`onUploadFiles` (see `file-manager-upload`) never see a file the ui-kit's own `maxFileSize` check has already rejected.

When `maxSelectableFileSize` is `undefined` (mirroring the existing "absent" case for grid selection), no `maxFileSize` prop value is passed either — no upload-size restriction is applied, consistent with the existing "absent means unrestricted" semantics.

RTL: none
Feature flag: none
i18n: `dialFileManager.uploadFileTooLarge` key (e.g. "Max file size is {{maxSize}}.")

#### Scenario: Oversized new upload is rejected by the ui-kit before onUploadFiles

- **WHEN** `maxSelectableFileSize` is `536_870_912` and the user selects a local file of `600_000_000` bytes via "Upload files"
- **THEN** `<DialFileManager>`'s own `maxFileSize` check rejects the file — `onValidateUpload`/`onUploadFiles` are never called for it
- **AND** the configured `oversizedUploadMessage` is shown

#### Scenario: No upload-size restriction when maxSelectableFileSize is absent

- **WHEN** `maxSelectableFileSize` is `undefined`
- **THEN** no `maxFileSize` value is passed to `<DialFileManager>`, and no newly-uploaded file is rejected for size

---

### Requirement: Attach handler skips hidden and MIME-invalid files with info toast

When the user clicks Attach, `DialFileManagerModal` SHALL:
1. Remove from the resolved set any selected file that is hidden (`isHiddenPath`: any path segment starts with `.`) or has a disallowed MIME type (when `allowedTypes` is provided).
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

When `maximumAttachmentsAmount` is provided as a finite number greater than `0`, `DialFileManagerModal` SHALL check the count of the valid (post-filter) selection **after** applying hidden and MIME filters. The count SHALL include both the valid current modal selection and `existingAttachmentsAmount` (default `0`) supplied by the host for attachments already present in the conversation input tray.

If the combined count exceeds `maximumAttachmentsAmount`, the modal SHALL:
1. Show an error notification (title: `DialFileManager.TooManyFilesSelected`, message: `DialFileManager.TooManyFilesDescription` with `{{count}}` and `{{limit}}`).
2. **Not** call `onAttach` — the modal stays open.

When `maximumAttachmentsAmount` is `undefined`, `0`, negative, or non-finite, no count restriction is applied.

i18n keys: `DialFileManager.TooManyFilesSelected`, `DialFileManager.TooManyFilesDescription` (params: `count`, `limit`)
RTL: none (toast only)
Feature flag: none
Memoisation: `handleAttach` in `useCallback`

#### Scenario: Too many files — modal stays open, error toast shown

- **WHEN** `maximumAttachmentsAmount` is `3`, user selects 5 valid files, and clicks Attach
- **THEN** an error toast is shown with count=5, limit=3, and `onAttach` is NOT called

#### Scenario: Previously attached files count toward limit

- **WHEN** `maximumAttachmentsAmount` is `2`
- **AND** `existingAttachmentsAmount` is `2`
- **AND** user selects 1 valid file and clicks Attach
- **THEN** an error toast is shown with count=3, limit=2
- **AND** `onAttach` is NOT called

#### Scenario: Count at limit

- **WHEN** `maximumAttachmentsAmount` is `3` and user selects exactly 3 valid files
- **THEN** `onAttach` is called with 3 files and the modal closes

#### Scenario: No count restriction when maximumAttachmentsAmount is absent

- **WHEN** `maximumAttachmentsAmount` is `undefined` or `0`
- **THEN** any count of valid files is accepted

#### Scenario: Count check applied after MIME filter

- **WHEN** `maximumAttachmentsAmount` is `2` and user selects 3 files (1 invalid MIME)
- **THEN** the post-filter count is 2 which equals the limit, so `onAttach` is called and the modal closes
