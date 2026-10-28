## Context

- **Today's download.** `onDownloadFiles` in `libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`:
  1. sets `isDownloading`;
  2. resolves a destination through the injected `DownloadDestinationHandlers.resolveDestination` (a "Save As" picker or a blob);
  3. fetches through the injected `DialFilesApi.downloadFile` / `downloadArchive`;
  4. hands the `Response` to `triggerDownload`, then clears the flag.
- **Why it blocks.** `isDownloading` feeds `isAnyOperationInProgress` (`useDialFileManager`), which disables actions, and `resolveOverlayAriaLabel` in `DialFileManagerShell`, which covers the surface with a loader.
- **Uploads already have the target UX.** `useDialFileUploadBatch` keeps a `FileUploadBatchState`. The shell renders it through the kit `TransferQueue` (`toUploadQueueItems`), with per-row cancel and, since #9482, failure reasons (`resolveUploadFailureReason`, `uploadFailureMessages`).
- **Transport facts.**
  - The single-file download response carries `Content-Length` (forwarded by `apps/chat-api/src/files/download/files-download.service.ts`).
  - The archive is a zip streamed by `apps/chat-api/src/files/archive/files-archive-download.service.ts` with no `Content-Length`.
  - `DialFilesApi.downloadFile` already takes a signal; `downloadArchive` doesn't, but the generated `downloadArchiveRaw` accepts `initOverrides`.
  - The app writes the body with `response.body.pipeTo(writable)` or `response.blob()` (`apps/chat/src/utils/file-download.ts`).
- **The kit row.** `TransferQueueRow` always draws an indeterminate `Spinner` for an in-progress row. `percent` only drives the collapsed aggregate bar.

## Goals / Non-Goals

**Goals:**

- Downloads never block the page. They show as rows in the same queue as uploads, with determinate or estimated progress, cancel, and a reason on failure.
- Reuse the upload batch pattern and the reason mapping. No new context, endpoint or flag.

**Non-Goals:** downloads outside File storage, a server-side archive size, retry from the row.

## Decisions

### 1. Download state lives next to upload state, in `chat-hooks`

A download batch (`FileDownloadBatchState`) is kept in `useDialFileMutations`, which already owns `onDownloadFiles`. It's modelled on `useDialFileUploadBatch`: an entries array plus a `Map<id, AbortController>` in a ref. It's exposed with `cancelDownloadFile`, `cancelAllDownloads` and `clearDownloadBatch` through `useDialFileManager` and `useDialFileManagerSections`, then the shell controller (`libs/chat-shared/src/file-manager/file-manager-controller.ts`).

- *Alternative:* a separate `useDialFileDownloadBatch` hook. Cleaner symmetry, but `onDownloadFiles` and its notifications already live in mutations, and splitting them means re-plumbing the destination handlers. Rejected for this change; a later refactor can extract it.

### 2. Progress is counted on the `Response`, not in the host

The hook wraps the response before `triggerDownload`:

```ts
new Response(response.body.pipeThrough(countingStream), {
  headers: response.headers,
  status: response.status,
});
```

`countingStream` is a `TransformStream` that adds `chunk.byteLength`.

- `triggerDownload` and the app's `file-download.ts` are untouched.
- `Content-Disposition` naming still works, because headers are copied.
- Updates are coalesced to one `setState` per animation frame per entry.
- The helper (`withDownloadProgress(response, onBytes)`) lives in `libs/chat-hooks/src/files/` and is pure, so it can be unit-tested with a `ReadableStream`.
- *Alternative:* a progress callback on `DownloadDestinationHandlers`. That pushes a lib concern into every host. Rejected.

### 3. Totals: `Content-Length` for files, estimated sizes for archives

- **File:** `total = Number(response.headers.get('content-length'))` when it's a positive number; otherwise `percent` stays unset.
- **Archive:** `total = sum(dialFiles[].contentLength)` only when every selected item is an `ITEM` with a numeric `contentLength`. A folder, or an item without a size, means no estimate. `percent = min(99, round(received / total * 100))` until the stream ends, then 100. The zip uses `store: true`, so its size is the sum plus small per-entry headers. The 99% cap absorbs that overshoot. (User decision.)

### 4. Cancel aborts the request and the body

- Each entry's `AbortController.signal` goes to `downloadFile(bucket, path, signal)` and to `downloadArchive(items, signal)`.
- `create-files-api.ts` passes `downloadArchiveRaw(params, { signal })`.
- Aborting rejects the fetch or errors the body stream. A stream destination's `pipeTo` then aborts the writable (default `preventAbort: false`), so no partial file is committed, and `blob()` rejects.
- An abort, detected as `signal.aborted`, settles the entry as `Cancelled` and skips both notifications.

### 5. One reason mapping for both kinds

`resolveUploadFailureReason` (`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`) already maps any error with a `response` through `getApiErrorDetails`, plus `UploadNetworkError`.

- **Download errors.** A non-OK fetch `Response` is turned into an error carrying that response; a fetch `TypeError` counts as Network. Both then go through the same mapping, which gets a neutral alias `resolveTransferFailureReason`. The upload name stays for compatibility.
- **Enum.** `FileUploadFailureReason` is reused for downloads rather than adding a second enum, since its members aren't upload-specific.
- **Messages.** Hosts keep one `uploadFailureMessages` map; its doc says it applies to both kinds.

### 6. One shared queue in the shell

- **Rows.** `toTransferQueueItems(uploadBatch, downloadBatch, failureMessages)` returns upload rows, then download rows, with ids prefixed `upload:` / `download:`.
- **Cancel.** The shell's `onCancelItem` strips the prefix and routes to `cancelUploadFile` or `cancelDownloadFile`.
- **Visibility.** The queue shows while either batch `isOpen`.
- **Closing.** Calls `cancelUpload` and `cancelAllDownloads`, then clears both batches. The kit confirms only while something runs (kit #952).
- **Title.** `labels.getTransferQueueTitle({ uploads, downloads })` (optional). It falls back to `getUploadQueueTitle(total)`, so hosts that don't adopt the new label still get a title.
- **Row wording.** Kit labels are per queue, not per row, so `cancelItemAriaLabel` / `itemProgressAriaLabel` are composed in the shell: download wording (`labels.downloadQueueLabels`) for names belonging to download rows, upload wording otherwise.
- **Overall progress.** The collapsed aggregate bar's `queueProgressAriaLabel` uses a "transfer progress" string when both kinds are present.
- **Overlay.** `resolveOverlayAriaLabel` loses its downloading branch.

### 7. Determinate ring in the kit

In `@epam/ai-dial-ui-kit` `TransferQueueRow`, an in-progress row with a numeric `percent` draws a small determinate ring: an SVG circle with `stroke-dasharray` at `DIAL_ICON_SIZE.SM`. It has `role="progressbar"`, `aria-valuenow`, and `aria-label={labels.itemProgressAriaLabel(name)}`. Without `percent`, the row keeps the `Spinner`. Cancel-on-hover keeps working, because it uses the same cell overlay as today. This ships as its own kit PR; chat picks it up with a kit bump and shows spinners until then.

### 8. Strings (app, `apps/chat/src/i18n/locales/en.json`, keys in `DialFileManagerI18nKeys`)

| Key | Text |
|---|---|
| `dialFileManager.downloadQueueTitle_one` / `_other` | "Downloading {{count}} file" / "Downloading {{count}} files" |
| `dialFileManager.transferQueueTitle_one` / `_other` | "Transferring {{count}} file" / "Transferring {{count}} files" (both kinds running) |
| `dialFileManager.downloadQueueCancelFileAriaLabel` | "Cancel downloading \"{{fileName}}\"" |
| `dialFileManager.downloadQueueFileProgressAriaLabel` | "Downloading \"{{fileName}}\"" |
| `dialFileManager.transferQueueProgressAriaLabel` | "Transfer progress" |

Failure messages reuse the upload ones. `apps/chat/src/hooks/files/useUploadQueueLabels.ts` grows into the transfer labels: `getTransferQueueTitle` picks the upload, download or transfer title from the counts, plus `downloadQueueLabels`.

## Library isolation

- `chat-hooks` keeps calling only the injected `DialFilesApi` and `DownloadDestinationHandlers`. There are no URLs and no browser download APIs; it only reads `Response.body` and headers, which it already receives.
- `chat-shared` gets every string from host labels.
- The kit ring is generic: it takes `percent` and a label.

## States

- **Loading.** An in-progress row shows a ring (known total) or a spinner (unknown), with cancel on hover or focus.
- **Error.** The row shows the failed icon with its reason tooltip; the error toast is unchanged.
- **Empty.** No download rows; the queue hides when both batches are closed.
- **Success.** A check on the row, plus the existing success toast. The queue auto-closes when every row succeeded (kit behaviour).

## Accessibility & RTL

The rows use kit semantics (labelled cancel button, progress name, reason as accessible name), and the queue stays a polite live region. The ring is drawn symmetrically and isn't mirrored. The queue keeps `inset-e-4` (logical), so RTL needs nothing new.

## Risks / Trade-offs

- [An archive estimate overshoots or undershoots] → capped at 99% until the stream ends; folders fall back to a spinner.
- [Many fast chunks cause re-renders] → updates coalesced per animation frame.
- [`pipeThrough` is missing in an old browser] → the target browsers (Safari 16.4+, Chrome 111+, Firefox 128+) support it. Without a body, the response is passed through unchanged and the row stays indeterminate.
- [A duplicate name in an upload and a download row gets the upload aria wording] → rare. The visible name is still correct, and wording is per kind, not per item.
- [Hosts that rely on `isDownloading` to block actions] → the field stays and means "a download is running". Only the internal gating changes, as documented in the spec.

## Migration Plan

1. Kit PR: determinate ring in `TransferQueueRow` (additive).
2. Chat PR: hooks, shell and labels. Works with spinners on the current kit.
3. Bump the kit in chat once it's released, to get rings.

Rollback: revert the chat PR (restores the flag and overlay). The kit change is additive.

## Open Questions

- None blocking. If the design later wants the archive to be exact, the BFF needs to compute the zip size up front, which is out of scope.
