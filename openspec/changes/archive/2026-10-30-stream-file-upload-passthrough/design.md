## Context

`POST /api/v1/files` today (after #9423 and #9574):

1. `FileUploadInterceptor` → `DiskFileUploadInterceptor`
   (`apps/chat-api/src/files/disk-file-upload.interceptor.ts`) runs multer
   `diskStorage({ destination: tmpdir() })` and waits until the **whole** part
   is on disk.
2. `FilesController.uploadFile` (`apps/chat-api/src/files/files.controller.ts`)
   hands `{ path, size, mimetype, originalname }` to
   `FilesUploadService.uploadFile`
   (`apps/chat-api/src/files/upload/files-upload.service.ts`).
3. `uploadFile` wraps `createReadStream(file.path)` in `UploadWatchdog.watch`
   (`apps/chat-api/src/files/upload/upload-watchdog.ts`) and calls
   `uploadFileStream`, which builds a multipart preamble/epilogue, computes
   `Content-Length = preamble + size + epilogue`, and issues a raw
   `dialClient.fetchCore(PUT, { body: Readable.toWeb(...), duplex: 'half' })`.

Steps 2–3 are already streaming. The only place the file is held at rest is
step 1, and step 1 exists only because multipart gives no size until the part
ends and no field order guarantee (`createUploadFileWithProgress` appends
`file` before `bucket`/`path`). Issue #9398 fails at 400 MB+ with a 503 and a
failing listing right after, consistent with the pod losing its ephemeral
storage / memory budget.

The browser side of the file manager is one seam:
`createUploadFileWithProgress`
(`libs/chat-hooks/src/files/create-upload-file-with-progress.ts`), composed by
the host in `apps/chat/src/server-api/upload-file-with-progress.ts` and used by
`createFilesApiClient.uploadFile` whenever `onProgress` is given — which
`useDialFileUploadBatch` always does.

## Goals / Non-Goals

**Goals:**

- File-manager uploads use O(stream buffers) BFF memory and zero BFF disk,
  independent of file size and concurrency.
- One transfer instead of two: bytes reach DIAL Core while the browser is
  still sending.
- Keep DIAL Core's `storage.maxUploadedFileSize` check working (exact
  `Content-Length`), and keep every existing status/message mapping.
- Additive: `POST /api/v1/files` and the lib's default behaviour unchanged.

**Non-Goals:** see proposal (attachments/transcription/import migration,
resumable uploads, direct-to-Core, ingress config).

## Decisions

### D1. Raw body on a new endpoint, size from `Content-Length`

`PUT /api/v1/files/content`, body = file bytes, metadata in the query. The
browser always sends `Content-Length` for `xhr.send(File)`, and Node's HTTP
parser guarantees the body is exactly that long (shorter = the connection
closed early; longer is impossible — extra bytes would be parsed as the next
request). So the declared size is trustworthy for computing the outgoing
`Content-Length` and for the `FILE_UPLOAD_MAX_BYTES` check before reading.

*Alternatives:* busboy over the existing multipart request — size unknown
until the end, so no exact `Content-Length` for Core, and field order forces a
frontend change anyway. Replacing `POST /api/v1/files` — same mechanics, but a
breaking contract change for the generated client and external callers.
`PUT` (not `POST`) because the request is "put these bytes at this path",
mirroring the DIAL Core call; `/content` keeps it distinct from the
multipart route on the same controller base path.

### D2. Metadata in the query, validated by a DTO that extends `UploadFileDto`

`UploadFileContentQueryDto extends UploadFileDto` + optional `contentType`
(`@IsOptional`, `@IsString`, `@MaxLength(255)`, `@Matches` a
`^[\w.+-]+\/[\w.+-]+$` allowlist — it is interpolated into the multipart
part header, so no `;`, CR/LF or quotes). Bound with `@Query()` through the
global `ValidationPipe` (whitelist + forbidNonWhitelisted). `filename` for the
part is the last `path` segment via the existing `getFileNameFromPath` — the
file manager already names the path after the file, so no extra field.

*Alternative:* custom headers (`X-Dial-Path`, …) — would need manual
validation outside `ValidationPipe` and non-ASCII path handling in headers.

### D3. Request `Content-Type` is fixed to `application/octet-stream`

`app.useBodyParser('json', …)` in `apps/chat-api/src/main.ts` (and Nest's
default urlencoded parser) would consume the stream for a `.json` or form-type
file if the browser's `file.type` were used as the request type. The client
therefore always sends `application/octet-stream` and carries the real MIME
type in `contentType`; the handler rejects any other request type with `415`
before touching the stream. No body parser is registered for
`application/octet-stream`, so `req` is still an unread `Readable` when the
handler runs. A unit/e2e test pins that (a `.json`-typed file must arrive
intact).

### D4. `FilesUploadService` gets a request-stream source, not a new pipeline

Extend the `UploadedFile` union with
`StreamedUploadFile { stream: Readable; size: number; mimetype; originalname? }`.
`readUploadedFile` returns `file.stream` for it; `getUploadedFileSize` returns
the declared size. Everything after that — `UploadWatchdog.watch`,
`uploadFileStream`, multipart envelope, exact `Content-Length`,
412→409/413/5xx mapping, abort messages — is reused unchanged. A small
counting step asserts the stream ended with exactly `size` bytes and otherwise
errors (aborting the Core request), as a guard against a non-Node transport
or a future refactor; with Node's parser it only fires on early close.

The controller handler (`uploadFileContent`) stays thin: check
`Content-Type` (415), parse `Content-Length` (411 if absent/invalid, 413 if
over `FILE_UPLOAD_MAX_BYTES`), then delegate to
`FilesService.uploadFileContent` → `FilesUploadService.uploadFile`. It uses
`@Req()` for the stream; no interceptor, no multer.

### D5. Client disconnect aborts the Core request

`req.on('close')` with `!req.complete` aborts an `AbortController` combined
with the watchdog signal (`AbortSignal.any`, available on the Node 24 runtime
image). `uploadFileStream` already destroys both streams on abort. The handler
then has no one to answer; the resulting exception is logged once at `warn`
("client closed the upload") instead of `error`, and no response is written
to a destroyed socket.

### D6. Early DIAL Core answers close the browser connection

DIAL Core may answer (403, 412, 413) before it has read the whole body. The
BFF then responds with the mapped status and `Connection: close`, stops
reading `req` and destroys it after the response is flushed, so it does not
pull the rest of a 500 MB body only to discard it. Some browsers report such a
response as a network error instead of the status; that degrades the toast to
"check your internet connection" in a case the frontend already pre-empts
(size is checked client-side against `maxAttachmentFileSizeBytes`,
`create-only` is derived from the cached listing). Accepted trade-off; the
e2e test asserts the status is sent.

### D7. Lib: opt-in `bodyEncoding`, host supplies URL and encoding

`createUploadFileWithProgress` gets `bodyEncoding?: UploadBodyEncoding`
(string enum, `Multipart` default, `Raw`). For `Raw` it opens
`PUT ${uploadUrl}?${URLSearchParams}`, sets
`Content-Type: application/octet-stream`, and `xhr.send(file)`; progress,
CSRF, 401, JSON parsing and abort handling are shared with the multipart
branch. The lib already knows the field names (`bucket`, `path`,
`uploadMode`) as form fields today; moving them to the query adds no new host
knowledge. The path `/api/v1/files/content` and the choice of `Raw` live in
the host adapter `apps/chat/src/server-api/upload-file-with-progress.ts`
(library isolation per `AGENTS.md`). The default keeps other hosts of
`@epam/ai-dial-chat-hooks` on the multipart request, so this is a minor,
non-breaking lib change.

### D8. Limits and authorization

No new env vars. `FILE_UPLOAD_MAX_BYTES` bounds the declared size;
`FILE_TRANSFER_TIMEOUT_MS` is the idle limit of the whole pass-through, so a
stalled browser now also trips `Stalled` (it previously stalled multer, bound
only by `requestTimeout`). Authorization: the global session guard and CSRF
guard apply as to every `PUT`; no role restriction, like `POST /api/v1/files`.

## Risks / Trade-offs

- [Ingress buffers anyway: nginx `proxy-request-buffering: on` (default) spools
  the body to the ingress pod's disk before proxying] → document in
  `apps/chat-api/README.md` that the BFF upload route should run with request
  buffering off; the BFF fix is still valid, the ingress just has its own
  limits (`proxy-body-size` already documented).
- [A slow browser now holds a DIAL Core connection for the whole upload
  (previously only the disk→Core leg)] → bounded by the 30-minute ceiling and
  the idle limit; concurrency per user is already capped by the batch's
  concurrency limit in `useDialFileUploadBatch`.
- [Early Core rejection seen as a network error by the browser (D6)] →
  client-side pre-checks; acceptable degradation, covered by a test on the
  BFF side.
- [A body parser added later for `*/*` or `application/octet-stream` would
  silently consume the stream] → D3 test fails if the stream arrives consumed.
- [`AbortSignal.any` not available on an older runtime] → runtime image pins
  Node 24; the local dev Node 20.19 also has it (≥ 20.3).
- [Two upload endpoints to maintain] → shared service path (D4); the multipart
  one is the follow-up candidate for retirement once attachments move.

## Migration Plan

1. Ship BFF endpoint + generated client (unused by the frontend yet).
2. Ship the lib option and switch the `apps/chat` adapter to `Raw` +
   `/api/v1/files/content` in the same release.
3. Deployment: no env changes; optionally turn off ingress request buffering
   for `/api/v1/files/content`.

Rollback: revert the adapter in
`apps/chat/src/server-api/upload-file-with-progress.ts` to the default
encoding and `/api/v1/files`; the endpoint can remain.

## Open Questions

- Does the dev ingress buffer request bodies? If yes, the 400 MB+ failure may
  also involve the ingress pod; QA should retest after deploy with buffering
  confirmed off.
- Follow-up: move conversation attachments, transcription and import to the
  streamed endpoint (needs a fetch-based raw upload in `createFilesApiClient`
  since they use the generated client without progress).
