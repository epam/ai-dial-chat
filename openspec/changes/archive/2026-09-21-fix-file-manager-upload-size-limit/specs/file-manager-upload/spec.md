## MODIFIED Requirements

### Requirement: `useDialFileManager` owns the upload batch and bounds its concurrency

`useDialFileManager` SHALL own all upload state — `uploadBatchState` and the batch `AbortController` — and SHALL expose `onUploadFiles`, `onValidateUpload`, and `cancelUpload`; no new React Context is introduced. At most `UPLOAD_CONCURRENCY = 3` files SHALL upload at once, with the rest held `Queued` until a slot frees. Each file SHALL be sent to the existing `POST /api/v1/files` endpoint at a path derived by stripping the virtual root prefix from the destination folder. Once every file has settled, the destination folder SHALL be evicted from the listing cache and re-fetched, and the progress modal SHALL auto-dismiss.

Pre-upload size rejection is handled entirely by the `@epam/ai-dial-react-file-manager` ui-kit component's own `maxFileSize`/`uploadValidationMessages.oversizedFiles` mechanism (see `dial-file-manager-attach-validation`'s "File-size cap in grid selection" and `file-manager-standalone-page`) — an oversized file never reaches `onUploadFiles` or `onValidateUpload` at all, so `useDialFileManager`/`onValidateUpload` require no code change for this concern.

#### Scenario: Upload a single file successfully

- **GIVEN** the user is on the root folder
- **WHEN** the user clicks "Upload files", selects `report.pdf`, and confirms
- **THEN** `onUploadFiles([{ name: 'report.pdf', fileContent: File }], '/All files')` is called
- **AND** `uploadBatchState` is set with one entry `{ name: 'report.pdf', status: FileUploadStatus.Queued }`
- **AND** `UploadProgressModal` opens showing the file name (no status label)
- **AND** the file transitions through internal `Uploading` with a progress bar, then `Completed`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'report.pdf', file }` via the XHR progress transport
- **AND** after completion the root folder cache is invalidated and re-fetched
- **AND** the modal auto-closes when the batch settles
#### Scenario: Upload multiple files

- **GIVEN** the user selects 5 files
- **WHEN** `onUploadFiles` is called
- **THEN** the first 3 files transition to "Uploading" simultaneously; the remaining 2 stay "Queued"
- **AND** as each file completes, the next queued file starts
- **AND** all 5 files eventually reach "Completed" or "Failed"
#### Scenario: Upload into a nested folder

- **GIVEN** the user is browsed into `/All files/reports/2026/`
- **WHEN** the user uploads `q1.pdf`
- **THEN** `onUploadFiles` receives `destinationFolder = '/All files/reports/2026/'`
- **AND** the hook strips the root prefix and derives `apiPath = 'reports/2026/'`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'reports/2026/q1.pdf', file }`
#### Scenario: Partial upload failure

- **GIVEN** the user uploads 3 files; the second fails with a `502` from the BFF
- **WHEN** the batch completes
- **THEN** files 1 and 3 reach `Completed` internally; file 2 reaches `Failed`
- **AND** the folder cache is still invalidated and re-fetched (successfully uploaded files appear)
- **AND** a success toast is shown for the completed upload batch
- **AND** the modal auto-closes when the batch settles

#### Scenario: Upload total failure

- **GIVEN** the user uploads 3 files and every request fails
- **WHEN** the batch completes
- **THEN** every file reaches `Failed` internally
- **AND** an error toast is shown with `dialFileManager.uploadFailed` and `dialFileManager.checkInternetConnection`
#### Scenario: File exceeding the configured maximum never reaches onUploadFiles

- **GIVEN** the user selects a file larger than the `maxFileSize` passed to `<DialFileManager>` (sourced from `AppConfig.config.maxAttachmentFileSizeBytes`, default 512 MB)
- **WHEN** the ui-kit's own upload-validation runs, ahead of `onValidateUpload`/`onUploadFiles`
- **THEN** that file is rejected by the ui-kit itself — `onUploadFiles` is never called for it, and no `POST /api/v1/files` request is ever made
- **AND** the ui-kit surfaces the configured `uploadValidationMessages.oversizedFiles` message
- **AND** any other, correctly-sized files in the same selection still upload normally

#### Scenario: File size exceeded server-side (defense in depth)

- **GIVEN** a file bypasses the ui-kit's client-side `maxFileSize` check (e.g. the host omitted the prop, or a caller invokes `onUploadFiles` directly) and is larger than `FILE_UPLOAD_MAX_BYTES` (default 512 MB)
- **WHEN** `POST /api/v1/files` receives the request
- **THEN** Multer rejects the request; the BFF returns `413 Payload Too Large`
- **AND** the file entry transitions to `Failed` internally; the modal auto-closes when the batch settles

### Requirement: Upload validation sanitizes names and defers collisions to the ui-kit

`onValidateUpload` SHALL sanitize each file's `name` in place with `sanitizeFileName` before any other check, SHALL NOT call the BFF, and SHALL NOT return `{ valid: false }` for a name collision — collisions belong to the ui-kit's own `ConflictResolutionPopup`, which a `{ valid: false }` result would suppress. `onValidateUpload` is unaffected by this change — size rejection happens earlier, inside the ui-kit's own `maxFileSize` check, before `onValidateUpload` is ever invoked for an oversized file.

#### Scenario: Validation sanitizes names and does not block on collision
- **WHEN** `onValidateUpload` is called with `[{ name: 'my:notes.txt' }]` and `my_notes.txt` exists in `existingFiles`
- **THEN** `DialUploadFileItem.name` is mutated to `'my_notes.txt'`
- **AND** `onValidateUpload` returns `{ valid: true }` (not `{ valid: false }`)
- **AND** the ui-kit subsequently detects the `my_notes.txt` collision and opens the conflict popup

#### Scenario: Validation returns valid true for non-colliding files
- **WHEN** `onValidateUpload` is called with a file whose sanitized name does not match any entry in `existingFiles`
- **THEN** returns `{ valid: true }` and the ui-kit proceeds to call `onUploadFiles` directly

#### Scenario: Duplicate filename conflict

- **GIVEN** the current folder already contains `notes.txt`
- **WHEN** the user selects a local file also named `notes.txt`
- **THEN** `onValidateUpload` detects the conflict and returns a `FileUploadValidationResult` indicating the conflict
- **AND** the ui-kit shows the conflict to the user before calling `onUploadFiles`
- **AND** the user must explicitly confirm or cancel; no silent overwrite occurs

### Requirement: Adding upload leaves the surrounding file-manager behavior unchanged

Introducing the upload flow SHALL NOT alter the existing Attach footer behavior, and SHALL NOT surface any mutation action the attach-profile modal does not already expose. Size enforcement is now layered: the ui-kit's own client-side `maxFileSize` check rejects an oversized file before any request is sent, and the BFF's existing server-side `FILE_UPLOAD_MAX_BYTES` Multer limit remains as the backing enforcement for any file that bypasses it.

#### Scenario: Unsupported file type / invalid name

- **GIVEN** `allowedFileTypes` is not set (all types allowed by default)
- **WHEN** the user selects any file within the size limit
- **THEN** no type rejection occurs at the BFF level (the BFF does not validate MIME type; `FILE_UPLOAD_MAX_BYTES` enforces size only, as a backstop behind the ui-kit's own client-side `maxFileSize` check)
#### Scenario: Existing Attach behavior unchanged

- **GIVEN** the upload modal is added alongside the existing Attach footer
- **WHEN** the user selects files and clicks "Attach" (no upload action taken)
- **THEN** the existing attach flow is unchanged; `UploadProgressModal` is not shown; no upload is triggered
#### Scenario: Unsupported mutation actions remain absent

- **GIVEN** the file manager modal is open
- **THEN** no delete, rename, move, copy, share, or permissions management UI is visible or reachable
