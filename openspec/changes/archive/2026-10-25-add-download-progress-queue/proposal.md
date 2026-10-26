## Why

Downloading from File storage freezes the whole page. `onDownloadFiles` in `libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts` sets a single `isDownloading` flag for the entire request and save. That flag feeds `isAnyOperationInProgress` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) and the full-surface "Preparing download…" overlay in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` (`resolveOverlayAriaLabel`). The user sees no progress, can't cancel, and can't do anything else until a large file or archive has finished. The design (Components 2.0 → Progress Notifications, node 2944-1402) puts downloads in the same progress notification as uploads, with a determinate loader, a reason on error, and cancel.

## What Changes

- **Downloads become non-blocking transfer items.**
  - A download, single file or archive, becomes a row in the same corner `TransferQueue` that already shows uploads, and the page stays usable.
  - Several downloads can run at once.
  - The blocking "Preparing download…" overlay and the download's share of `isAnyOperationInProgress` are removed.
- **Real progress.**
  - A single file reports `bytesReceived / Content-Length`; the BFF already forwards `content-length` (`apps/chat-api/src/files/download/files-download.service.ts`).
  - An archive is a zip streamed without `Content-Length`, so its total is estimated from the selected files' `contentLength`, capped at 99% until the stream ends.
  - A selection whose size can't be estimated (a folder with unknown contents) falls back to an indeterminate row.
- **Cancel.** Each download row can be canceled. It aborts the request (`downloadFile` already takes a signal; `downloadArchive` gains one) and writes nothing. Closing the queue while something is running asks for confirmation, then aborts uploads and downloads alike.
- **Errors with a reason.** A failed download row shows a reason tooltip, using the same reason mapping as uploads (`FileUploadFailureReason` → a shared transfer failure reason). The existing error toast stays.
- **One shared queue.** The upload batch and the new download batch render as one `TransferQueue`. Its title counts each kind, for example "Downloading 1 file", "Uploading 2 files", or a combined title while both run.
- **Kit: determinate row loader** (`@epam/ai-dial-ui-kit` `TransferQueue`). An in-progress row with a numeric `percent` draws a determinate ring instead of the indeterminate `Spinner`. Rows without `percent` keep the spinner. This ships in the kit first; chat works before the bump, with spinners.
- **Unchanged.** The success toast after a completed download (`FileOperationKind.FileDownloaded` / `FilesDownloaded`) and the "Save As" destination flow (`DownloadDestinationHandlers`).

## Capabilities

### New Capabilities

- `file-manager-download-queue`: download rows in the File storage transfer queue. Covers lifecycle (in progress → success/failed/canceled), determinate progress for single files and estimated progress for archives, cancel, failure reasons, the shared upload+download queue and its title, and the removal of the blocking download overlay.

### Modified Capabilities

- `file-manager-download`: the frontend flow no longer holds a page-blocking `isDownloading`. A download is a queue row with progress and cancel, and `isDownloading` no longer disables other actions. The success-toast requirement stays.
- `chat-shared-file-manager-ui`: the shell's `TransferQueue` renders upload and download rows together, under a title built from both counts.
- `file-manager-operation-ux`: `isDownloading` leaves `isAnyOperationInProgress`, and the consolidated blackout overlay no longer covers downloads; `labels.downloadingLabel` is deprecated.
- `chat-hooks-file-manager-mutations`: `onDownloadFiles` registers a cancellable, progress-reporting download entry instead of toggling one flag. `DialFilesApi.downloadArchive` accepts an `AbortSignal`.

## Impact

- **`libs/chat-hooks`**
  - `useDialFileMutations` gets a download batch state, progress and cancel; this follows the upload batch in `useDialFileUploadBatch`.
  - `DialFilesApi.downloadArchive(items, signal?)` and `create-files-api.ts` gain the signal.
  - New helper that wraps a fetch `Response` with a byte-counting stream.
  - `resolveUploadFailureReason` is generalised for downloads.
- **`libs/chat-shared`**
  - Transfer entry/model types (download entry and kind), `toTransferQueueItems` (uploads + downloads), shell wiring, and labels (`getTransferQueueTitle`, download strings).
  - The download overlay branch is removed.
- **`apps/chat`**: label hooks (`useUploadQueueLabels` → transfer labels) and new i18n keys. `useDialFileManagerHostOptions` (the destination handlers) is unchanged.
- **`@epam/ai-dial-ui-kit`**: determinate ring in `TransferQueueRow`. Chat needs a kit version bump to show rings; without it, rows show spinners and work the same otherwise.
- **Library isolation.** No lib learns host details. Download URLs stay in the generated client behind the injected `DialFilesApi`, the save location stays behind the injected `DownloadDestinationHandlers`, and all strings come from host labels.
- **i18n.** New keys for the download queue title and the combined title, a download-cancel aria label, and a download item progress aria label. Failure reason texts are reused from uploads.
- **Scope note.** This touches shared libs (`chat-hooks`, `chat-shared`, kit). There is no new context, no new endpoint and no feature flag.

## Non-goals

- Downloads outside File storage (attachments in chat, prompt/skill exports, conversation export, which already uses its own queue).
- A server-side `Content-Length` for archives. The zip is generated on the fly (`store: true`); computing its size needs a separate BFF change.
- Resuming or retrying failed downloads from the row.

## Alternatives considered

1. **Keep the overlay and add a progress percent to it (baseline).** Least work, but the page stays frozen and nothing can be canceled or run in parallel, which is the reported bug. Rejected.
2. **A separate download queue stacked above the upload queue.** Simpler state, but two panels in the corner when both run. The user chose one shared queue.
3. **Indeterminate spinner for archives.** Honest but not the determinate loader the design asks for. The user chose an estimate from file sizes, with a spinner fallback when unknown.

## Acceptance criteria

- Starting a download never shows the blocking overlay. The grid, tree and toolbar stay interactive, and a second download can start while the first runs.
- A single-file download row shows a percentage that reaches 100% before success. An archive row shows estimated progress capped at 99% until done.
- Canceling a download row aborts the request, shows the row as canceled, writes no file, and raises no toast.
- A failed download row shows a reason tooltip, and the existing error toast still appears. A successful one still raises the existing success toast.
- Uploads and downloads appear in one queue, with a title that reflects what is running.
- Closing the queue while anything runs asks for confirmation and aborts everything still running.

## Rollback / compatibility

Not breaking for hosts that use `DialFileManagerShell` with the shared labels. New labels are optional with English fallbacks, and `getUploadQueueTitle` keeps working as the uploads-only title. `isDownloading` stays on the controller (still true while any download runs) but stops gating other actions. Revert by restoring `onDownloadFiles`' flag flow and the overlay branch. The kit ring is additive, so reverting it brings back spinners.
