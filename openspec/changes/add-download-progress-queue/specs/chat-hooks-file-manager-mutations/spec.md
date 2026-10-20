## ADDED Requirements

### Requirement: Downloads are cancellable, progress-reporting batch entries

`useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`) SHALL expose:

- `downloadBatchState: FileDownloadBatchState | null`;
- `cancelDownloadFile(id: string)`;
- `cancelAllDownloads()`;
- `clearDownloadBatch()`.

`useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) and `useDialFileManagerSections` SHALL pass them through. `onDownloadFiles` SHALL add an entry, run the transfer in the background, and settle the entry as `FileDownloadStatus.Completed`, `Failed` (with `failureReason`) or `Cancelled`. It SHALL no longer hold a page-wide flag that blocks other mutations. `isDownloading` is derived from the batch (some entry in progress) and SHALL NOT be folded into `isAnyOperationInProgress`.

`DialFilesApi.downloadArchive` (`libs/chat-hooks/src/files/dial-files-api.ts`) SHALL accept an optional `signal?: AbortSignal`, mirroring `downloadFile`. `createFilesApiClient` (`libs/chat-hooks/src/files/create-files-api.ts`) SHALL forward it to the generated `downloadArchiveRaw` call as a request-init override.

The hook SHALL NOT read browser download APIs or URLs. Progress is counted on the `Response` body it already receives from the injected `DialFilesApi`, and the bytes are still written through the injected `DownloadDestinationHandlers.triggerDownload`.

#### Scenario: onDownloadFiles returns before the transfer ends

- **WHEN** `onDownloadFiles([file])` is called
- **THEN** a download entry appears with status `FileDownloadStatus.Downloading`, and `isAnyOperationInProgress` stays `false`

#### Scenario: Archive downloads can be aborted

- **WHEN** `cancelDownloadFile` is called for an archive entry
- **THEN** the signal passed to `downloadArchive` is aborted and the entry becomes `Cancelled`

#### Scenario: Clearing the batch

- **WHEN** `clearDownloadBatch()` is called after every entry settled
- **THEN** `downloadBatchState` is `null`
