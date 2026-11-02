## Context

Issue #9398: a file of 100–250 MB uploaded from the file manager fails with the
toast "Upload failed / Please check your internet connection and try again."
#9423 replaced the absolute 30 s timeout on the BFF → DIAL Core PUT with a
progress watchdog (`apps/chat-api/src/files/upload/upload-watchdog.ts`), but QA
re-opened the issue with a 250 MB file.

The request path has two legs and several limits:

| Leg | Limit today | Effect |
|---|---|---|
| browser → BFF | Node `server.requestTimeout` default 300 000 ms (unset in `apps/chat-api/src/main.ts`) | body still flowing at 5 min → `408` + socket close → XHR `error` → `FileUploadFailureReason.Network` |
| browser → BFF | multer `memoryStorage`, `limits.fileSize = FILE_UPLOAD_MAX_BYTES` | whole file in RAM; `Buffer.concat` peaks ~2× per file, `UPLOAD_CONCURRENCY = 3` |
| BFF → Core | `UploadWatchdog` (idle `FILE_TRANSFER_TIMEOUT_MS`, 2 min response, 30 min ceiling) | fine |
| BFF → Core | Core `storage.maxUploadedFileSize` (default 512 MB), checked in Core's `Proxy` against `Content-Length` only | streamed PUT is chunked → Core reads its 1024-byte default → never enforced |

Verified locally: a Node server with a reduced `requestTimeout` answers `408`
to a body that keeps flowing; undici `fetch` with a stream body and
`duplex: 'half'` sends a caller-supplied `Content-Length` verbatim and rejects
with `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` when the body length differs.

The UI side: `useDialFileUploadBatch` (`libs/chat-hooks`) already resolves a
per-file `FileUploadFailureReason` (`resolveUploadFailureReason` in
`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`) and the queue
row shows reason-specific text (`useUploadQueueLabels`), but the batch toast
emits a bare `UploadFailed`, which the app adapter always renders with
`dialFileManager.checkInternetConnection`.

## Goals / Non-Goals

**Goals:**
- A progressing upload up to `FILE_UPLOAD_MAX_BYTES` completes, however slow,
  within the 30-minute ceiling.
- The BFF's memory use per upload is bounded by stream buffers, not file size.
- DIAL Core's own upload limit is enforced again.
- The user sees why an upload failed, including the size limit after a `413`.

**Non-Goals:**
- Resumable uploads; ingress configuration; the conversation-input upload path.

## Decisions

### D1. Receive timeout = existing 30-minute ceiling

Set `requestTimeout` on the Nest HTTP server to `UPLOAD_MAX_DURATION_MS`
(1 800 000). Extract it as `configureHttpServerTimeouts(server)` in a new
`apps/chat-api/src/common/utils/http-server-timeouts.ts` so it is
unit-testable; `main.ts` calls it right
after `NestFactory.create`. The helper imports `UPLOAD_MAX_DURATION_MS` from
`apps/chat-api/src/files/upload/upload-watchdog.ts`, so the receive timeout and
the transfer ceiling cannot drift apart.

`headersTimeout` (60 s default) is untouched, so the header-phase slowloris
guard stays. `requestTimeout` is server-wide in Node (no per-route setting), so
every request may now take up to 30 minutes to *send its body*; JSON bodies are
already capped by `CONVERSATION_BODY_SIZE_LIMIT_BYTES`.

*Alternatives:* `requestTimeout = 0` (unbounded — rejected, no ceiling); a new
env var (rejected — no operator need; matches the fixed ceiling the
`file-upload` spec already declares).

### D2. Disk staging via a shared interceptor

Generalise `ArchiveUploadInterceptor` into an abstract
`DiskFileUploadInterceptor` (new `apps/chat-api/src/files/disk-file-upload.interceptor.ts`)
parameterised by the max-bytes config key and the 413 message. It keeps the
existing behaviour verbatim: multer `diskStorage({ destination: tmpdir() })`,
`limits: { fileSize, files: 1 }`, `LIMIT_FILE_SIZE → PayloadTooLargeException`,
other `MulterError → BadRequestException`, and temp-file removal in `finalize`
plus on parse failure (with the existing `basename`/`tmpdir` containment
guard). Two concrete subclasses:

- `ArchiveUploadInterceptor` — `ARCHIVE_UPLOAD_MAX_BYTES`, `'Archive payload too large'` (unchanged).
- `FileUploadInterceptor` — `FILE_UPLOAD_MAX_BYTES`, `'File too large'` (the
  message Nest's `FileInterceptor` produced, so the 413 body does not change).

`POST /api/v1/files` swaps `FileInterceptor('file')` for `FileUploadInterceptor`;
the `MulterModule.registerAsync` block in `FilesModule` is deleted (no other
route in the module uses it). multer 2.4 already removes a partially written
file when the client aborts mid-stream (`abortWithError` → `_removeFile` on
pending writes), so aborted uploads leave nothing behind.

`UploadedFile` (in `files-upload.service.ts`) becomes a union:

```ts
interface UploadedFileMeta { mimetype: string; originalname?: string }
export interface StagedUploadFile extends UploadedFileMeta { path: string; size: number }
export interface BufferedUploadFile extends UploadedFileMeta { buffer: Buffer }
export type UploadedFile = StagedUploadFile | BufferedUploadFile;
```

The controller passes the staged file; `FilesFolderService.createFolder` keeps
passing a zero-byte `buffer` marker. `uploadFile` opens
`createReadStream(path, { highWaterMark: UPLOAD_CHUNK_BYTES })` or
`sliceBuffer(buffer)`, and `UploadWatchdog.watch` accepts
`AsyncIterable<Buffer> | Iterable<Buffer>` (`for await` handles both).

*Alternatives:* pass-through streaming without staging (rejected in the
proposal: file arrives before `bucket`/`path` are validated, and its size is
unknown for D3); keeping `memoryStorage` (rejected: ~2× file size × 3
concurrent uploads per user).

### D3. Exact `Content-Length` on every streamed PUT

`uploadFileStream` takes a required `fileSize` (bytes of the file part) and
builds the preamble/epilogue buffers first, so

```
Content-Length = preamble.length + fileSize + epilogue.length
```

is exact. Sources: `StagedUploadFile.size` (multer), `buffer.length`, and the
`entryBytes` already returned by `stageArchiveEntryToTemp` for archive entries.
If the file changed size on disk, undici rejects with a length-mismatch error,
which the existing `handleDialFetchError` path turns into a 5xx — never a
silently truncated upload.

Core then applies `storage.maxUploadedFileSize` to the whole multipart body; a
Core `413` already maps to `PayloadTooLargeException` in `mapDialHttpStatus`
(`apps/chat-api/src/common/dial/dial-error.mapper.ts`). Because Core counts the
multipart envelope (a few hundred bytes) and multer counts only file bytes, a
file within a few hundred bytes of an identical limit on both sides gets Core's
`413` instead of multer's — same status, same UI. README guidance: keep
`FILE_UPLOAD_MAX_BYTES` ≤ Core's `storage.maxUploadedFileSize`.

### D4. Failure reason on the batch notification (lib boundary)

`FileManagerNotification` (`libs/chat-hooks/src/files/dial-file-manager.types.ts`)
gains `failureReason?: FileUploadFailureReason` (type from
`@epam/ai-dial-chat-shared`, already a chat-hooks peer). `useDialFileUploadBatch`
collects each failed file's resolved reason; on an all-failed batch it sets
`failureReason` when every failed file has the same reason, and leaves it unset
when reasons differ. The lib still emits only structured data — no strings, no
size, no config — so library isolation holds; the app adapter owns wording and
the limit.

### D5. App wording and the size limit

`buildFileManagerNotificationOptions(t, notification, { maxUploadSize })` —
`maxUploadSize` is the already-formatted string (or `undefined`).
`useDialFileManagerHostOptions` reads `useAppConfig().config.maxAttachmentFileSizeBytes`
and formats it with `formatFileSize` (the helper `DialFileManagerPage` already
uses for `oversizedUploadMessage`). `UploadFailed` body by reason:

| `failureReason` | Body |
|---|---|
| `Network` | `dialFileManager.checkInternetConnection` |
| `TooLarge` | `dialFileManager.uploadFileTooLarge` `{ maxSize }` → "Max file size is 512 MB."; falls back to `dialFileManager.uploadFailedTooLarge` when no positive limit is configured |
| `Conflict` | `dialFileManager.uploadConflict` |
| `Forbidden` | `dialFileManager.noPermissionToCreate` (via `DialFileManagerI18nKeys.NoPermissionToCreate`) |
| `Unavailable` | `dialFileManager.uploadFailedUnavailable` |
| `Unknown` / unset (mixed) | new `dialFileManager.uploadFailedSeeQueue` — "Check the upload list for details." |

Title stays `dialFileManager.uploadFailed`. `useUploadQueueLabels` uses the same
`TooLarge` wording (with fallback) for the per-row message. Both read the limit
from `useAppConfig` — the hook's two hosts (`DialFileManagerPage`,
`DialFileManagerModal`) already render inside `AppConfigProvider`.

No new UI surface: toast and queue row already exist; text is direction-neutral
(no RTL impact) and the toast region's existing live-region semantics apply. No
feature gate.

## Risks / Trade-offs

- [Temp disk: up to `FILE_UPLOAD_MAX_BYTES` × concurrent uploads in `os.tmpdir()`]
  → same footprint `upload-archive` already accepts; documented in the README
  so operators size the container's ephemeral storage / `emptyDir`.
- [30-minute `requestTimeout` server-wide lengthens how long a slow-body client
  can hold a socket] → header phase still capped at 60 s; JSON bodies are
  size-capped; ingress normally fronts the BFF. Accepted for correctness.
- [Ingress in front of the BFF (`proxy-body-size`, `proxy-read-timeout`,
  request buffering) can still cut uploads] → out of scope; README note.
- [Core limit < `FILE_UPLOAD_MAX_BYTES` makes the toast quote the BFF limit
  while Core rejected a smaller file] → README: keep them aligned.

## Migration Plan

Deploy as a normal release; no data or contract migration. Rollback = revert.

## Open Questions

- QA's environment details (ingress limits, Core `maxUploadedFileSize`) are
  unknown; if the issue persists after this change, the ingress is the next
  suspect.
