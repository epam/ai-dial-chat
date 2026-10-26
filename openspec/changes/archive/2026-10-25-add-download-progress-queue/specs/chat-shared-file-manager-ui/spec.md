## MODIFIED Requirements

### Requirement: Loader modal and upload queue preserve their exact inputs

`@epam/ai-dial-chat-shared` SHALL export `OperationLoaderModal` with props `{ title: string; text: string; cancelLabel: string; onCancel: () => void }`. There is no `UploadProgressModal`.

`DialFileManagerShell` SHALL render one UI kit `TransferQueue` for both uploads and downloads, fed by `toTransferQueueItems(uploadBatch, downloadBatch, failureMessages)` (exported from the `./file-manager` entry, next to the existing `toUploadQueueItems`):

- Upload rows come from the `FileUploadBatchState` shape `{ files: FileUploadEntry[]; isOpen: boolean }`, where `FileUploadEntry` is `{ id; name; status: FileUploadStatus; percent?; failureReason? }`.
- Download rows come from `FileDownloadBatchState` `{ files: FileDownloadEntry[]; isOpen: boolean }`, whose entries carry `status: FileDownloadStatus` (`Downloading` maps to in-progress; `Completed`, `Failed`, `Cancelled` as for uploads).
- `FileUploadStatus` has members `Queued`, `Uploading`, `Completed`, `Failed`, and `Cancelled`.
- Upload rows come first, then download rows.
- Row ids are prefixed by kind (`upload:` / `download:`), so cancel routes to the right batch.

The queue is shown while either batch is open. Its title SHALL come from `labels.getTransferQueueTitle({ uploads, downloads })` when the host supplies it, otherwise from `labels.getUploadQueueTitle(count)` with the total count. Its strings come from `labels.uploadQueueLabels`, with download-specific row wording from `labels.downloadQueueLabels` (cancel and progress aria labels), matched to each row by its kind.

A failed row's tooltip and accessible name come from `labels.uploadFailureMessages[entry.failureReason]`, used for both kinds. No fabricated aggregate count fields are required.

The shell SHALL NOT render its blocking loader overlay for downloads: `resolveOverlayAriaLabel` no longer has a downloading branch.

#### Scenario: Upload state renders from current entries

- **WHEN** a batch contains queued, uploading, completed, failed, and cancelled entries
- **THEN** the `TransferQueue` renders one row per entry, mapping `Queued`/`Uploading` to in-progress, `Completed` to success, `Failed` to failed, and `Cancelled` to canceled, with each entry's `percent`

#### Scenario: Uploads and downloads share one queue

- **WHEN** two files are uploading and one file is downloading
- **THEN** one `TransferQueue` shows three rows, uploads first, under the title from `getTransferQueueTitle({ uploads: 2, downloads: 1 })`

#### Scenario: Cancellation is preserved

- **WHEN** the user cancels one upload row
- **THEN** the controller's `cancelUploadFile` is called with that entry's id

#### Scenario: Canceling a download row

- **WHEN** the user cancels one download row
- **THEN** the controller's `cancelDownloadFile` is called with that entry's id

#### Scenario: Closing the queue aborts everything still running

- **WHEN** the user confirms closing the queue while an upload and a download are in progress
- **THEN** `cancelUpload` and `cancelAllDownloads` are called, followed by `clearUploadBatch` and `clearDownloadBatch`

#### Scenario: No blocking overlay for downloads

- **WHEN** a download is in progress
- **THEN** the shell renders no loader overlay
