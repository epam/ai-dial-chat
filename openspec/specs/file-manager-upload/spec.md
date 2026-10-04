# file-manager-upload Specification

## Purpose

File upload in the file manager (the attach modal and the standalone page): validation, concurrency, per-file upload mode, ZIP-archive upload, the upload queue, and cache invalidation. The upload logic lives in `useDialFileUploadBatch` (`libs/chat-hooks/src/files/useDialFileUploadBatch/useDialFileUploadBatch.ts`), which `useDialFileManager` composes. The queue is the UI kit's `TransferQueue`, rendered by the shared `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`).

## Requirements

### Requirement: `useDialFileManager` owns the upload batch and bounds its concurrency

Upload state SHALL be owned by the `useDialFileUploadBatch` sub-hook, which `useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) composes. That state is `uploadBatchState: FileUploadBatchState | null` (`{ files: FileUploadEntry[]; isOpen: boolean }`) plus one `AbortController` per queued or uploading file, keyed by entry id. `useDialFileManager` SHALL expose `onUploadFiles`, `onUploadArchive`, `onValidateUpload`, `uploadBatchState`, `cancelUpload`, `cancelUploadFile`, and `clearUploadBatch`. No React Context is introduced.

`FileUploadStatus` (`Queued = 'queued'`, `Uploading = 'uploading'`, `Completed = 'completed'`, `Failed = 'failed'`, `Cancelled = 'cancelled'`), `FileUploadEntry` (`{ id; name; status; percent? }`) and `FileUploadBatchState` are defined in `libs/chat-shared/src/file-manager/upload-batch.ts` (`@epam/ai-dial-chat-shared`).

At most `UPLOAD_CONCURRENCY = 3` files (`libs/chat-hooks/src/files/dial-file-manager.model.ts`) SHALL upload at once, with the rest held `Queued` until a slot frees. A batch started while another is still on screen SHALL be appended to it, with entry ids unique across batches. Settled entries SHALL stay in `uploadBatchState` until `clearUploadBatch` runs, which happens when the queue is closed. The hook does not clear the batch by itself.

Each file SHALL be sent to `POST /api/v1/files` at `<destinationApiPath><file.name>`, where `destinationApiPath` is the destination folder with the virtual root prefix stripped (`virtualPathToApiPath(destinationFolder, rootLabel)`). On the My files tab the bucket is the caller's own bucket. On the Shared tab the bucket and base path come from `resolveOwnerCoords(destinationApiPath, sharedRootMeta, bucket)`, which yields the owner's bucket. Once every file of a batch has settled, the hook SHALL call the `invalidateFolders([destinationApiPath])` and `bumpRetry()` callbacks owned by `useDialFileListing`, so the destination folder is evicted from the listing cache and re-fetched. The upload hook holds no copy of the cache.

Pre-upload size rejection is handled entirely by the `@epam/ai-dial-react-file-manager` component's own `maxFileSize`/`uploadValidationMessages.oversizedFiles` mechanism (see `dial-file-manager-attach-validation`'s "File-size cap in grid selection" and `file-manager-standalone-page`). An oversized file never reaches `onUploadFiles` or `onValidateUpload` at all.

#### Scenario: Upload a single file successfully

- **GIVEN** the user is on the root folder
- **WHEN** the user clicks the upload action, selects `report.pdf`, and confirms
- **THEN** `onUploadFiles([{ name: 'report.pdf', fileContent: File }], '/All files')` is called
- **AND** `uploadBatchState.files` gains one entry `{ id, name: 'report.pdf', status: FileUploadStatus.Queued }`
- **AND** the upload `TransferQueue` shows a row for `report.pdf`
- **AND** the entry transitions through `Uploading` (with `percent` from the progress transport), then `Completed` at `percent: 100`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'report.pdf', file }` via the XHR progress transport
- **AND** after completion the root folder cache is invalidated and re-fetched
- **AND** the queue closes itself 8 seconds later, because every row succeeded

#### Scenario: Upload multiple files

- **GIVEN** the user selects 5 files
- **WHEN** `onUploadFiles` is called
- **THEN** the first 3 files transition to `Uploading` simultaneously; the remaining 2 stay `Queued`
- **AND** as each file settles, the next queued file starts
- **AND** all 5 files eventually reach `Completed` or `Failed`

#### Scenario: A second batch joins the queue on screen

- **GIVEN** the upload queue still shows the settled rows of an earlier batch
- **WHEN** the user uploads another file
- **THEN** the new file's row is appended below the earlier rows, and the queue title counts every row

#### Scenario: Upload into a nested folder

- **GIVEN** the user is browsed into `/All files/reports/2026/`
- **WHEN** the user uploads `q1.pdf`
- **THEN** `onUploadFiles` receives `destinationFolder = '/All files/reports/2026/'`
- **AND** the hook strips the root prefix and derives `destinationApiPath = 'reports/2026/'`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'reports/2026/q1.pdf', file }`

#### Scenario: Upload into a shared folder targets the owner's bucket

- **GIVEN** the active tab is Shared and the user is browsed into a folder another user shared with them
- **WHEN** the user uploads a file
- **THEN** the upload goes to the bucket and base path that `resolveOwnerCoords` resolves for that folder, not to the caller's own bucket

#### Scenario: Partial upload failure

- **GIVEN** the user uploads 3 files; the second fails with a `502` from the BFF
- **WHEN** the batch completes
- **THEN** files 1 and 3 reach `Completed`; file 2 reaches `Failed`
- **AND** the folder cache is still invalidated and re-fetched (successfully uploaded files appear)
- **AND** a success toast is shown for the batch
- **AND** the queue stays open with the failed row until the user closes it

#### Scenario: Upload total failure

- **GIVEN** the user uploads 3 files and every request fails
- **WHEN** the batch completes
- **THEN** every file reaches `Failed`
- **AND** an error toast is shown with `dialFileManager.uploadFailed` and `dialFileManager.checkInternetConnection`

#### Scenario: File exceeding the configured maximum never reaches onUploadFiles

- **GIVEN** the user selects a file larger than the `maxFileSize` passed to `<DialFileManager>` (sourced from `AppConfig.config.maxAttachmentFileSizeBytes`, default 512 MB)
- **WHEN** the file manager's own upload-validation runs, ahead of `onValidateUpload`/`onUploadFiles`
- **THEN** that file is rejected by the file manager itself — `onUploadFiles` is never called for it, and no `POST /api/v1/files` request is ever made
- **AND** the file manager surfaces the configured `uploadValidationMessages.oversizedFiles` message
- **AND** any other, correctly-sized files in the same selection still upload normally

#### Scenario: File size exceeded server-side (defense in depth)

- **GIVEN** a file bypasses the client-side `maxFileSize` check (e.g. the host omitted the prop, or a caller invokes `onUploadFiles` directly) and is larger than `FILE_UPLOAD_MAX_BYTES` (default 512 MB)
- **WHEN** `POST /api/v1/files` receives the request
- **THEN** Multer rejects the request; the BFF returns `413 Payload Too Large`
- **AND** the file entry transitions to `Failed`, and its queue row shows the failure

### Requirement: Uploads go through the injected `DialFilesApi` port

`useDialFileUploadBatch` SHALL perform every upload through the injected `DialFilesApi` port (`libs/chat-hooks/src/files/dial-files-api.ts`), calling `filesApi.uploadFile(bucket, path, file, { signal, uploadMode, onProgress })`. It SHALL NOT import app server-api modules. The app wires the port in `apps/chat/src/server-api/dial-files-api.adapter.ts` to the `uploadFile`/`uploadArchive` exports of `apps/chat/src/server-api/files.api.ts`. Those come from `createFilesApiClient(filesApi, uploadFileWithProgress)` (`libs/chat-hooks/src/files/create-files-api.ts`). When `onProgress` is supplied, `uploadFile` uses the app's `uploadFileWithProgress` (`apps/chat/src/server-api/upload-file-with-progress.ts`), because fetch exposes no upload progress. That function is built by `createUploadFileWithProgress` from `@epam/ai-dial-chat-hooks`, with the app's CSRF and unauthorized handlers and `uploadUrl: '/api/v1/files'`. It sends an `XMLHttpRequest` `POST` with the multipart fields `file`, `bucket`, `path`, and `uploadMode` when one is set. Otherwise it calls the generated `filesApi.uploadFile({ bucket, path, file, uploadMode })`. Both paths accept an `AbortSignal` and return `{ url: string }`. The endpoint contract is unchanged (see `file-upload`).

#### Scenario: Progress uploads use the XHR transport

- **WHEN** the hook uploads a file with an `onProgress` callback
- **THEN** the request is sent by `uploadFileWithProgress`, and each progress event updates that entry's `percent`

#### Scenario: The lib never reaches the app's server-api

- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `useDialFileUploadBatch` depends only on the `DialFilesApi` port, not on `apps/chat/src/server-api`

### Requirement: A ZIP archive can be uploaded and extracted into a folder

`onUploadArchive(file, name, destinationFolder)` SHALL upload the archive through `filesApi.uploadArchive(file, bucket, '<destinationApiPath><name>/')` (`POST /api/v1/files/upload-archive`), which extracts it into a folder named `name` in the caller's bucket. The archive appears as one queue entry: `Uploading` until the request settles, then `Completed` or `Failed` at `percent: 100`. It has no `AbortController`, so cancelling does not abort it. The hook SHALL raise these notifications through `onNotification`:

- every extracted entry failed: `UploadArchiveFailed`, with up to 5 `path (error)` names and a rest count (`dialFileManager.uploadArchiveFilesError`)
- some entries failed: `UploadArchivePartiallyFailed`, with the failed count, names and rest count (`dialFileManager.uploadArchivePartialError`); the entry is still `Completed`
- the request itself threw: `UploadArchiveRequestFailed` (`dialFileManager.uploadArchiveError`)

The destination folder SHALL be invalidated and re-fetched whatever the outcome. When `onUploadFiles` receives exactly one file whose `fileContent.name` ends in `.zip` but whose item `name` does not (an archive renamed during conflict resolution), it SHALL route that file to the archive path under the item's `name` instead of uploading it as a file.

#### Scenario: Archive extracts into a named folder

- **WHEN** the user uploads `data.zip` as an archive named `data` into `/All files/reports/`
- **THEN** `uploadArchive` is called with destination path `reports/data/`, and the queue shows one `data` row that settles as `Completed`

#### Scenario: Some archive entries fail

- **GIVEN** an archive whose extraction reports 2 failed entries out of 10
- **WHEN** the request settles
- **THEN** an error toast states that 2 items could not be uploaded and names them, and the queue row is `Completed`

### Requirement: Cancelling a batch aborts in-flight uploads and issues no further requests

`cancelUpload()` SHALL abort every per-file `AbortController` still registered, and `cancelUploadFile(id)` SHALL abort only that file's controller. The kit's per-row cancel control calls `cancelUploadFile` through `onCancelItem`. An aborted in-flight file SHALL become `Cancelled`, and a queued file whose controller is already aborted SHALL become `Cancelled` when a worker reaches it, without a `POST /api/v1/files` request. Files that completed before the cancellation SHALL remain, and the folder cache SHALL still be invalidated so they appear. A batch in which every file was cancelled SHALL raise no toast. Closing the queue runs `cancelUpload()` then `clearUploadBatch()`.

#### Scenario: Upload cancellation

- **GIVEN** an upload batch of 4 files is in progress (2 uploading, 2 queued)
- **WHEN** the user closes the queue and confirms
- **THEN** `cancelUpload()` aborts every remaining controller
- **AND** the 2 in-flight requests receive an abort signal and reject
- **AND** no further `POST /api/v1/files` requests are issued for the 2 queued files
- **AND** the folder cache is invalidated (any files that completed before cancellation are visible)

#### Scenario: Cancelling one file leaves the rest running

- **GIVEN** a batch of 3 files is uploading
- **WHEN** the user activates the cancel control on one row
- **THEN** `cancelUploadFile` aborts only that file, its row shows "Canceled", and the other files keep uploading

### Requirement: Upload validation sanitizes names and defers collisions to the ui-kit

`onValidateUpload(files, existingFiles, destinationFolder)` SHALL sanitize each file's `name` in place with `sanitizeFileName` (`libs/chat-hooks/src/files/file-name.ts`) and SHALL then return `{ valid: true }`. It SHALL NOT call the BFF and SHALL NOT return `{ valid: false }` for a name collision. Collisions belong to the file manager's own conflict-resolution popup (configured through `conflictResolutionPopupOptions`), which a `{ valid: false }` result would suppress. Size rejection happens earlier, inside the file manager's own `maxFileSize` check.

#### Scenario: Validation sanitizes names and does not block on collision

- **WHEN** `onValidateUpload` is called with `[{ name: 'my:notes.txt' }]` and `my_notes.txt` exists in `existingFiles`
- **THEN** `DialUploadFileItem.name` is mutated to `'my_notes.txt'`
- **AND** `onValidateUpload` returns `{ valid: true }` (not `{ valid: false }`)
- **AND** the file manager subsequently detects the `my_notes.txt` collision and opens the conflict popup

#### Scenario: Validation returns valid true for non-colliding files

- **WHEN** `onValidateUpload` is called with a file whose sanitized name does not match any entry in `existingFiles`
- **THEN** it returns `{ valid: true }` and the file manager proceeds to call `onUploadFiles` directly

#### Scenario: Duplicate filename conflict

- **GIVEN** the current folder already contains `notes.txt`
- **WHEN** the user selects a local file also named `notes.txt`
- **THEN** `onValidateUpload` only sanitizes the name and returns `{ valid: true }`
- **AND** the file manager itself detects the conflict and shows it to the user before calling `onUploadFiles`
- **AND** the user must explicitly confirm or cancel; no silent overwrite occurs

### Requirement: Upload mode is derived per file from the cached listing

`onUploadFiles` SHALL choose each file's `uploadMode` by case-insensitively matching its name against the cached listing for `destinationApiPath`: a match yields `DialFilesApiUploadMode.Overwrite` (`'overwrite'`), an absence yields `DialFilesApiUploadMode.CreateOnly` (`'create-only'`). The chosen mode SHALL be passed through `filesApi.uploadFile(...)` into the multipart request.

#### Scenario: Replace — overwrite mode

- **WHEN** `onUploadFiles` is called with `{ name: 'notes.txt' }` and `notes.txt` exists in the cached listing
- **THEN** `uploadMode: 'overwrite'` is passed to `uploadFile`
- **AND** `POST /api/v1/files` is called without `If-None-Match` — DIAL Core overwrites the existing file

#### Scenario: Duplicate — create-only mode

- **WHEN** `onUploadFiles` is called with `{ name: 'notes (1).txt' }` generated by the file manager after the user chose Duplicate
- **AND** `notes (1).txt` does not exist in the cached listing
- **THEN** `uploadMode: 'create-only'` is passed to `uploadFile`
- **AND** `POST /api/v1/files` is called with `uploadMode: 'create-only'` → BFF sends `If-None-Match: *` to DIAL Core

#### Scenario: Fresh upload — create-only mode

- **WHEN** `onUploadFiles` is called with a file whose name is absent from the cached listing (no prior collision)
- **THEN** `uploadMode: 'create-only'` is passed to `uploadFile`
- **AND** the upload proceeds as create-only for race safety

### Requirement: The upload batch reports progress and its outcome

`DialFileManagerShell` SHALL render the upload queue as the UI kit's `TransferQueue` (`@epam/ai-dial-ui-kit`) inside a `fixed bottom-4 end-4 z-[70]` container. Its items come from `toUploadQueueItems` (`libs/chat-shared/src/file-manager/upload-queue.ts`): `Queued` and `Uploading` map to `InProgress`, `Completed` to `Success`, `Failed` to `Failed`, and `Cancelled` to `Canceled`, carrying each entry's `percent`. The queue renders nothing while there are no entries. Its `title` is `labels.getUploadQueueTitle(count)` and its strings are `labels.uploadQueueLabels`. Both are supplied by the hosts (`DialFileManagerPage`, `DialFileManagerModal`) through `useUploadQueueLabels` (`apps/chat/src/hooks/files/useUploadQueueLabels.ts`), which adds the upload-specific strings to the shared `useTransferQueueLabels` chrome. The shell itself calls no `useTranslation`.

The queue SHALL offer a close control (`onClose`) and a per-row cancel control (`onCancelItem={cancelUploadFile}`). Closing while a file is in progress or has failed first asks for confirmation. The kit closes the queue by itself 8 seconds after every row has succeeded. A canceled or failed row keeps it open.

When a batch settles and not every file was cancelled, `useDialFileUploadBatch` SHALL emit one notification through `onNotification`. If at least one file completed, the reason is `UploadCompleted`, with `folder` set to the upload base path or the root label. If none completed and at least one failed, the reason is `UploadFailed`. The app adapter (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`) maps them to `dialFileManager.uploadSuccess` and to `dialFileManager.uploadFailed` + `dialFileManager.checkInternetConnection`.

#### Scenario: Closing an unfinished queue asks first

- **WHEN** an upload batch is in progress and the user activates the queue's close control
- **THEN** a confirmation dialog appears, and only confirming cancels the remaining uploads and clears the queue

#### Scenario: A settled batch reports its outcome once

- **GIVEN** a batch that was not entirely cancelled
- **WHEN** every file has settled
- **THEN** exactly one toast is emitted — success, or the failure pair

#### Scenario: The title counts every row

- **GIVEN** the queue holds 3 rows
- **THEN** its title reads "Uploading 3 files" (`dialFileManager.uploadQueueTitle_other`)

### Requirement: Upload queue strings are translated by the host

The upload queue's strings SHALL come from these `apps/chat/src/i18n/locales/en.json` keys (members of `DialFileManagerI18nKeys`), resolved by the host and passed to the shell as labels:

| Key | English |
|-----|---------|
| `dialFileManager.upload` | `"Files"` (toolbar upload-files label) |
| `dialFileManager.uploadArchiveAction` | `"Archive"` |
| `dialFileManager.uploadQueueTitle_one` / `_other` | `"Uploading {{count}} file"` / `"Uploading {{count}} files"` |
| `dialFileManager.uploadQueueCancelFileAriaLabel` | `"Cancel uploading \"{{fileName}}\""` |
| `dialFileManager.uploadQueueFileProgressAriaLabel` | `"Uploading \"{{fileName}}\""` |
| `dialFileManager.uploadQueueProgressAriaLabel` | `"Upload progress"` |
| `dialFileManager.uploadSuccess` | `"The file has been uploaded successfully to “{{parentPath}}”"` |
| `dialFileManager.uploadFailed` | `"Upload failed"` (also the failed-row fallback message) |
| `dialFileManager.checkInternetConnection` | `"Please check your internet connection and try again."` |
| `dialFileManager.uploadConflict` | `"A file with this name already exists"` |
| `dialFileManager.uploadArchiveError` | `"Failed to upload the archive"` |
| `dialFileManager.uploadArchiveFilesError_one` / `_other` | `"Failed to upload this archive file: {{files}}"` / `"Failed to upload these archive files: {{files}}"` |
| `dialFileManager.uploadArchivePartialError_one` / `_other` | `"{{count}} item in the archive could not be uploaded: {{files}}"` / `"{{count}} items in the archive could not be uploaded: {{files}}"` |

The queue's direction-agnostic chrome (collapse/expand/close names, close confirmation, "Canceled"/"Completed", aggregate value text) is shared with the conversation import/export queues under `ConversationExportI18nKeys` (see `conversation-export`).

#### Scenario: Upload queue strings resolve through i18n

- **WHEN** the upload queue renders in English
- **THEN** its title, per-row cancel and progress names, and failed-row message come from the keys above, not from the kit's English defaults

### Requirement: The upload surface is accessible, direction-agnostic, and stable across re-renders

The upload queue SHALL be a non-modal `role="status"` / `aria-live="polite"` region (kit `TransferQueue`) with no focus trap. The only dialog is the close-confirmation popup. Each in-progress row's spinner SHALL carry an accessible name from `uploadQueueFileProgressAriaLabel`, and its cancel control an accessible name from `uploadQueueCancelFileAriaLabel`. The cancel control is revealed on hover and always reachable by keyboard. While collapsed with work running, the queue SHALL show the kit `ProgressBar` named by `uploadQueueProgressAriaLabel`. The queue container is positioned with logical `end-4`, so it moves to the opposite corner in RTL. Its row icons are symmetric and are not mirrored. `onUploadFiles`, `onUploadArchive`, `onValidateUpload`, `cancelUpload`, `cancelUploadFile`, and `clearUploadBatch` SHALL each be wrapped in `useCallback`. Upload SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Progress is announced, not only drawn

- **WHEN** a file is uploading
- **THEN** its row exposes a named progress spinner inside a polite live region
- **AND** its cancel control is reachable by keyboard with an accessible name naming the file

#### Scenario: Upload callbacks keep their identity

- **WHEN** the host re-renders without changing bucket, tab, cache, or translations
- **THEN** `onUploadFiles`, `onValidateUpload`, and `cancelUpload` keep their previous references

### Requirement: Adding upload leaves the surrounding file-manager behavior unchanged

Introducing the upload flow SHALL NOT alter the existing Attach footer behavior, and SHALL NOT surface any mutation action the attach-profile modal does not already expose. Size enforcement is layered: the file manager's own client-side `maxFileSize` check rejects an oversized file before any request is sent, and the BFF's existing server-side `FILE_UPLOAD_MAX_BYTES` Multer limit remains as the backing enforcement for any file that bypasses it.

#### Scenario: Unsupported file type / invalid name

- **GIVEN** `allowedFileTypes` is not set (all types allowed by default)
- **WHEN** the user selects any file within the size limit
- **THEN** no type rejection occurs at the BFF level (the BFF does not validate MIME type; `FILE_UPLOAD_MAX_BYTES` enforces size only, as a backstop behind the client-side `maxFileSize` check)

#### Scenario: Existing Attach behavior unchanged

- **GIVEN** the upload action is available alongside the existing Attach footer
- **WHEN** the user selects files and clicks "Attach" (no upload action taken)
- **THEN** the existing attach flow is unchanged; the upload queue is not shown; no upload is triggered

#### Scenario: The attach modal exposes only the Attach action profile

- **GIVEN** the file manager modal is open, so `useDialFileManager` runs with `DialFileManagerVariant.Attach` and therefore `DialFileManagerActionProfile.Attach`
- **THEN** on the My files tab only Download, Delete (with its confirmation dialog) and, in a writable folder, Rename are offered
- **AND** Copy, Move and Duplicate are absent (`isCopyMoveDuplicateAllowed` is false for `Attach`), Unshare and Remove access are absent (`isShareActionsAllowed` requires `Full`), and Info is absent on every tab
- **AND** the other tabs offer only Download
