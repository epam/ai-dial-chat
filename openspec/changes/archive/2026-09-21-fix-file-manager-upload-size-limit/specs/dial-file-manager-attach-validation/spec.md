## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: New-upload size cap uses the ui-kit's native maxFileSize check

`DialFileManagerModal` SHALL pass the same `maxSelectableFileSize` value into `FileManagerAttachModal`'s (and, through it, `DialFileManagerShell`'s) `maxFileSize` prop on `<DialFileManager>` from `@epam/ai-dial-react-file-manager` — the vendor component's own built-in pre-upload size check, distinct from `maxSelectableFileSize`'s existing-file-selection check. `DialFileManagerModal` SHALL also pass a translated `oversizedUploadMessage` string (new prop on `FileManagerAttachModal`/`DialFileManagerShell`), forwarded to `<DialFileManager>`'s `uploadValidationMessages.oversizedFiles`.

This is a single AppConfig-sourced numeric value doing double duty: it bounds which already-listed files are selectable (`maxSelectableFileSize` → `isRowSelectable`) and, via the same value forwarded as `maxFileSize`, which freshly-picked local files the ui-kit accepts into an upload batch at all. `onValidateUpload`/`onUploadFiles` (see `file-manager-upload`) never see a file the ui-kit's own `maxFileSize` check has already rejected.

When `maxSelectableFileSize` is `undefined` (mirroring the existing "absent" case for grid selection), no `maxFileSize` prop value is passed either — no upload-size restriction is applied, consistent with the existing "absent means unrestricted" semantics.

RTL: none
Feature flag: none
i18n: new `dialFileManager.uploadFileTooLarge` key (see `file-manager-standalone-page` for the exact string)

#### Scenario: Oversized new upload is rejected by the ui-kit before onUploadFiles

- **WHEN** `maxSelectableFileSize` is `536_870_912` and the user selects a local file of `600_000_000` bytes via "Upload files"
- **THEN** `<DialFileManager>`'s own `maxFileSize` check rejects the file — `onValidateUpload`/`onUploadFiles` are never called for it
- **AND** the configured `oversizedUploadMessage` is shown

#### Scenario: No upload-size restriction when maxSelectableFileSize is absent

- **WHEN** `maxSelectableFileSize` is `undefined`
- **THEN** no `maxFileSize` value is passed to `<DialFileManager>`, and no newly-uploaded file is rejected for size
