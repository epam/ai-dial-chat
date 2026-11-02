## MODIFIED Requirements

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

- **GIVEN** the user uploads 3 files and every request fails with no response (network error)
- **WHEN** the batch completes
- **THEN** every file reaches `Failed`
- **AND** an error toast is shown with `dialFileManager.uploadFailed` and `dialFileManager.checkInternetConnection`

#### Scenario: Upload total failure with a server-side reason

- **GIVEN** the user uploads 2 files and both requests are answered with `503`
- **WHEN** the batch completes
- **THEN** every file reaches `Failed`
- **AND** the error toast reads `dialFileManager.uploadFailed` with `dialFileManager.uploadFailedUnavailable`, not `dialFileManager.checkInternetConnection`

#### Scenario: Upload total failure with mixed reasons

- **GIVEN** the user uploads 2 files; one is answered with `409`, the other with `503`
- **WHEN** the batch completes
- **THEN** the error toast reads `dialFileManager.uploadFailed` with `dialFileManager.uploadFailedSeeQueue`
- **AND** each queue row shows its own reason

#### Scenario: File exceeding the configured maximum never reaches onUploadFiles

- **GIVEN** the user selects a file larger than the `maxFileSize` passed to `<DialFileManager>` (sourced from `AppConfig.config.maxAttachmentFileSizeBytes`, default 512 MB)
- **WHEN** the file manager's own upload-validation runs, ahead of `onValidateUpload`/`onUploadFiles`
- **THEN** that file is rejected by the file manager itself — `onUploadFiles` is never called for it, and no `POST /api/v1/files` request is ever made
- **AND** the file manager surfaces the configured `uploadValidationMessages.oversizedFiles` message
- **AND** any other, correctly-sized files in the same selection still upload normally

#### Scenario: File size exceeded server-side (defense in depth)

- **GIVEN** a file bypasses the client-side `maxFileSize` check (e.g. the host omitted the prop, or a caller invokes `onUploadFiles` directly) and is larger than `FILE_UPLOAD_MAX_BYTES` (default 512 MB), or DIAL Core rejects its size
- **WHEN** `POST /api/v1/files` receives the request
- **THEN** the BFF returns `413 Payload Too Large`
- **AND** the file entry transitions to `Failed` with `failureReason: FileUploadFailureReason.TooLarge`
- **AND** its queue row reads `dialFileManager.uploadFileTooLarge` with `maxSize` formatted from `AppConfig.config.maxAttachmentFileSizeBytes` — "Max file size is 512 MB." by default
- **AND** if that was the only file, the error toast body is the same message

### Requirement: The upload batch reports progress and its outcome

`DialFileManagerShell` SHALL render the upload queue as the UI kit's `TransferQueue` (`@epam/ai-dial-ui-kit`) inside a `fixed bottom-4 end-4 z-[70]` container. Its items come from `toUploadQueueItems` (`libs/chat-shared/src/file-manager/upload-queue.ts`): `Queued` and `Uploading` map to `InProgress`, `Completed` to `Success`, `Failed` to `Failed`, and `Cancelled` to `Canceled`, carrying each entry's `percent`. The queue renders nothing while there are no entries. Its `title` is `labels.getUploadQueueTitle(count)` and its strings are `labels.uploadQueueLabels`. Both are supplied by the hosts (`DialFileManagerPage`, `DialFileManagerModal`) through `useUploadQueueLabels` (`apps/chat/src/hooks/files/useUploadQueueLabels.ts`), which adds the upload-specific strings to the shared `useTransferQueueLabels` chrome. The shell itself calls no `useTranslation`.

The queue SHALL offer a close control (`onClose`) and a per-row cancel control (`onCancelItem={cancelUploadFile}`). Closing while a file is in progress or has failed first asks for confirmation. The kit closes the queue by itself 8 seconds after every row has succeeded. A canceled or failed row keeps it open.

When a batch settles and not every file was cancelled, `useDialFileUploadBatch` SHALL emit one notification through `onNotification`. If at least one file completed, the reason is `UploadCompleted`, with `folder` set to the upload base path or the root label. If none completed and at least one failed, the reason is `UploadFailed`, with `failureReason` set to the `FileUploadFailureReason` every failed file shares, or left unset when the failed files have different reasons. The app adapter (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`, `buildFileManagerNotificationOptions`) maps `UploadCompleted` to `dialFileManager.uploadSuccess`, and `UploadFailed` to the title `dialFileManager.uploadFailed` with a body chosen by `failureReason`:

| `failureReason` | Body key |
|---|---|
| `Network` | `dialFileManager.checkInternetConnection` |
| `TooLarge` | `dialFileManager.uploadFileTooLarge` with `maxSize`; `dialFileManager.uploadFailedTooLarge` when no positive limit is configured |
| `Conflict` | `dialFileManager.uploadConflict` |
| `Forbidden` | `dialFileManager.noPermissionToCreate` |
| `Unavailable` | `dialFileManager.uploadFailedUnavailable` |
| `Unknown` or unset | `dialFileManager.uploadFailedSeeQueue` |

`maxSize` is `AppConfig.config.maxAttachmentFileSizeBytes` (sourced from `FILE_UPLOAD_MAX_BYTES` through the `attachments.maxFileSizeBytes` config key) formatted with `formatFileSize`, resolved by `useDialFileManagerHostOptions` and passed to the adapter; the lib never sees the limit or the strings. `useUploadQueueLabels` uses the same `TooLarge` wording for the failed-row message.

#### Scenario: Closing an unfinished queue asks first

- **WHEN** an upload batch is in progress and the user activates the queue's close control
- **THEN** a confirmation dialog appears, and only confirming cancels the remaining uploads and clears the queue

#### Scenario: A settled batch reports its outcome once

- **GIVEN** a batch that was not entirely cancelled
- **WHEN** every file has settled
- **THEN** exactly one toast is emitted — success, or the failure title with its reason-specific body

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
| `dialFileManager.uploadFailedTooLarge` | `"The file is too large to upload"` (fallback when no size limit is configured) |
| `dialFileManager.uploadFileTooLarge` | `"Max file size is {{maxSize}}."` |
| `dialFileManager.uploadFailedUnavailable` | `"The file service is unavailable. Please try again later."` |
| `dialFileManager.uploadFailedSeeQueue` | `"Check the upload list for details."` (new) |
| `dialFileManager.uploadArchiveError` | `"Failed to upload the archive"` |
| `dialFileManager.uploadArchiveFilesError_one` / `_other` | `"Failed to upload this archive file: {{files}}"` / `"Failed to upload these archive files: {{files}}"` |
| `dialFileManager.uploadArchivePartialError_one` / `_other` | `"{{count}} item in the archive could not be uploaded: {{files}}"` / `"{{count}} items in the archive could not be uploaded: {{files}}"` |

The queue's direction-agnostic chrome (collapse/expand/close names, close confirmation, "Canceled"/"Completed", aggregate value text) is shared with the conversation import/export queues under `ConversationExportI18nKeys` (see `conversation-export`).

#### Scenario: Upload queue strings resolve through i18n

- **WHEN** the upload queue renders in English
- **THEN** its title, per-row cancel and progress names, and failed-row message come from the keys above, not from the kit's English defaults

