# file-manager-download-queue Specification

## Purpose

Download rows in the File storage transfer queue: a non-blocking lifecycle (in progress, success, failed, canceled), determinate progress for single files and estimated progress for archives, per-row cancel, failure reasons, and accessibility.

## Requirements

### Requirement: A download is a non-blocking queue row

Download state SHALL be owned by `useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`) as a download batch `{ files: FileDownloadEntry[]; isOpen: boolean }`, exposed through `useDialFileManager` and the shell controller alongside the existing `uploadBatchState`. Each `onDownloadFiles(dialFiles)` call SHALL add one `FileDownloadEntry`: `{ id; name; status: FileDownloadStatus; percent?; failureReason?: FileUploadFailureReason }`, where `FileDownloadStatus` (`libs/chat-shared/src/file-manager/upload-batch.ts`) has members `Downloading`, `Completed`, `Failed`, `Cancelled`, and `FileUploadFailureReason` is reused as the failure reason for both kinds. Its `name` is the file name for a single item, or the archive name (`<folder>.zip` / `files.zip`) otherwise. The call SHALL return immediately, without awaiting the transfer. Starting a download SHALL NOT show the shell's blocking loader overlay, and SHALL NOT contribute to `isAnyOperationInProgress`. Several downloads MAY run at the same time, each as its own entry. `isDownloading` SHALL stay on the controller as "at least one download entry is in progress", for hosts that read it; it no longer disables actions.

#### Scenario: The page stays usable while a download runs

- **WHEN** the user downloads a large file from File storage
- **THEN** no blocking overlay or "Preparing download…" loader appears, the grid, tree and toolbar stay interactive, and a download row appears in the transfer queue

#### Scenario: Two downloads run at once

- **WHEN** the user starts a second download while the first is in progress
- **THEN** the queue shows two in-progress download rows, and both finish independently

#### Scenario: A dismissed Save As picker adds no row

- **WHEN** the host's destination resolves `DownloadDestinationType.Cancelled`
- **THEN** no download entry is added and no notification is raised

### Requirement: Download progress is determinate for files and estimated for archives

`useDialFileMutations` SHALL wrap each download `Response` in a byte-counting stream before handing it to `DownloadDestinationHandlers.triggerDownload`, and update the entry's `percent` as bytes arrive. Updates SHALL be throttled to at most one state update per animation frame per entry.

- **Single file:** the total SHALL be the response's `Content-Length`, which the BFF forwards. `percent` = `round(received / total * 100)`, and it reaches 100 when the stream ends.
- **Archive:** the BFF streams the zip without `Content-Length`, so the total SHALL be estimated as the sum of the selected items' `DialFile.contentLength`. `percent` SHALL be capped at 99 until the stream ends, then set to 100.
- **Unknown total:** when no total is known (no `Content-Length` for a file; any selected folder, or any item without `contentLength`, for an archive), `percent` SHALL stay unset, so the row shows the indeterminate loader.

#### Scenario: A single file reports real progress

- **WHEN** a 10 MB file with `Content-Length: 10485760` is half received
- **THEN** its row shows 50%, and it shows 100% before turning into success

#### Scenario: An archive of sized files reports estimated progress

- **WHEN** three files of 1, 2 and 3 MB are downloaded as an archive and 6 MB of zip has arrived, but the stream has not ended
- **THEN** the row shows 99%, and it turns into success only when the stream ends

#### Scenario: A selection with a folder shows the indeterminate loader

- **WHEN** a folder is downloaded as an archive
- **THEN** the row has no `percent` and shows the indeterminate loader until it settles

### Requirement: A download can be canceled from its row

Each download entry SHALL own an `AbortController` whose signal is passed to `DialFilesApi.downloadFile` / `DialFilesApi.downloadArchive`. Canceling the row (`cancelDownloadFile(id)`) SHALL abort the request and any in-flight body read. It SHALL set the entry to `Cancelled` and raise neither the success nor the error notification. When the host destination is a file-system stream (`DownloadDestinationType.Stream`), the writable SHALL be aborted, so no partial file is left committed.

#### Scenario: Cancel mid-download

- **WHEN** the user cancels a download row at 40%
- **THEN** the request is aborted, the row shows "Canceled", no file is saved, and no toast appears

### Requirement: A failed download shows its reason

When a download fails (a non-OK response, a rejected request, or a broken stream), the entry SHALL become `Failed` with a `failureReason`. The reason is resolved by the same mapping used for uploads (`resolveUploadFailureReason`, generalised as a transfer failure reason in `libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`): 403 Forbidden, 409 Conflict, 413 TooLarge, 502/503 Unavailable, no response Network, anything else Unknown. The row's tooltip and accessible name SHALL be the host's message for that reason, or the generic failed message for Unknown. The existing error notification (`FileManagerNotificationReason.DownloadFileFailed` / `DownloadFilesFailed`) SHALL still be raised.

#### Scenario: Forbidden download

- **WHEN** the download responds 403
- **THEN** the row shows the failed icon whose tooltip reads the "no permission" message, and the download error toast appears

### Requirement: Accessibility of download rows

Download rows SHALL use the kit `TransferQueue` row semantics: an in-progress row exposes its progress with an accessible name, its cancel control is a labelled button reachable by keyboard, and a failed row's reason is its icon's accessible name, not only a tooltip. The queue root remains a polite live region. No new focus trap or modal is introduced.

#### Scenario: Keyboard cancel

- **WHEN** a keyboard user tabs to an in-progress download row's cancel control and presses Enter
- **THEN** the download is canceled and announced through the queue's live region as canceled
