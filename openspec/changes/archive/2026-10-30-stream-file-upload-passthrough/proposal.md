## Why

Issue #9398: on dev (`1.3.0-dev.204`, after #9423 and #9574) a file-manager
upload of 300–350 MB succeeds, but 400 MB and above fails with "The file service
is unavailable" (`503`), and the file list right after it fails too — the
service as a whole went away, not just the upload.

Since #9574, `POST /api/v1/files` stages every file on the BFF pod before
sending it on: `FileUploadInterceptor` → `DiskFileUploadInterceptor`
(`apps/chat-api/src/files/disk-file-upload.interceptor.ts`) writes the whole
part to `os.tmpdir()` with multer `diskStorage`, and only then
`FilesUploadService.uploadFile`
(`apps/chat-api/src/files/upload/files-upload.service.ts`) streams it to DIAL
Core. Every in-flight upload therefore costs the pod up to
`FILE_UPLOAD_MAX_BYTES` (512 MB) of ephemeral storage — or of RAM when `/tmp` is
a memory-backed `emptyDir` — and a size threshold that eviction / OOM explains
and a timeout does not. It also makes the user wait for two full transfers in
sequence (browser → BFF disk, then disk → Core).

Raising the pod's ephemeral-storage limit only moves the threshold and still
scales with `concurrent uploads × 512 MB`. The BFF does not need the file at
rest at all: it already streams to Core with an exact `Content-Length`, and the
browser already knows the file size.

## What Changes

- New BFF endpoint `PUT /api/v1/files/content` (operationId `uploadFileContent`)
  that takes the file as the raw request body (`application/octet-stream`) with
  `bucket`, `path`, `uploadMode` and an optional `contentType` as query
  parameters, and pipes the body to DIAL Core `PUT /v1/files/{bucket}/{path}`
  inside the existing multipart envelope. Nothing is written to disk and only
  stream buffers are held in memory; backpressure runs end to end
  (Core socket ← BFF ← browser socket).
- The request `Content-Length` is required (`411` without it) and checked
  against `FILE_UPLOAD_MAX_BYTES` before any body byte is read (`413`).
  The outgoing PUT keeps the exact `Content-Length`
  (`preamble + declared size + epilogue`) the current endpoint sends.
- The existing progress watchdog (`UploadWatchdog`) bounds the whole
  pass-through: idle `FILE_TRANSFER_TIMEOUT_MS`, 2 min response, 30 min ceiling.
  A browser that disconnects mid-body aborts the Core request.
- `createUploadFileWithProgress` (`libs/chat-hooks`) gains an optional
  `bodyEncoding` dependency (`UploadBodyEncoding.Multipart` default,
  `UploadBodyEncoding.Raw`). `Raw` sends `PUT` with `xhr.send(file)` and the
  fields in the query string. `apps/chat` switches its file-manager upload
  (`apps/chat/src/server-api/upload-file-with-progress.ts`) to `Raw` +
  `/api/v1/files/content`.
- `POST /api/v1/files` (multipart, disk-staged) is **unchanged** and stays the
  transport for the generated-client callers (conversation attachments, audio
  transcription, conversation import) and for external API clients.

Not breaking: a new endpoint plus an optional lib dependency whose default
keeps today's behaviour.

## Non-goals

- Moving conversation attachments, transcription and import off
  `POST /api/v1/files` — follow-up; they keep disk staging for now.
- Removing or changing `POST /api/v1/files`, `upload-archive`, or the folder
  marker path in `FilesFolderService`.
- Resumable / chunked uploads (DIAL Core has no API to assemble parts).
- Browser → DIAL Core direct upload (would expose the access token the BFF
  keeps server-side).
- Ingress configuration; documented as a deployment note only.

## Alternatives considered

| Option | Verdict |
|---|---|
| Keep staging, raise pod ephemeral storage / move `/tmp` off tmpfs (baseline) | Deployment-only, but cost still scales with concurrency × 512 MB and keeps the double transfer. Recommended as the immediate dev mitigation, not the fix. |
| Stream the existing multipart request with busboy | Keeps the contract, but the browser appends `file` before `bucket`/`path` (so the frontend changes anyway), and the part size is unknown until the end, so the exact `Content-Length` DIAL Core needs for `storage.maxUploadedFileSize` cannot be computed. |
| **Raw-body pass-through on a new endpoint (pick)** | Size known up front from `Content-Length`, no parser, no disk, reuses `uploadFileStream`/`UploadWatchdog`; additive contract. |
| Replace `POST /api/v1/files` with raw body | Same mechanics but breaks the generated client and external callers in one go. |

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `file-upload`: adds the streamed raw-body upload requirement
  (`PUT /api/v1/files/content`), its validation, limits and error mapping.
- `chat-hooks-api-transport`: `createUploadFileWithProgress` accepts
  `bodyEncoding` and, for `Raw`, sends a `PUT` with the file as the body and the
  fields as query parameters.
- `file-manager-upload`: the host's file-manager upload goes through the raw
  streamed endpoint.

## Impact

- **BFF** (`apps/chat-api/src/files/`): new controller handler and query DTO,
  a request-stream variant of `UploadedFile` in `FilesUploadService`, client
  disconnect → abort wiring. No new env vars; `FILE_UPLOAD_MAX_BYTES` and
  `FILE_TRANSFER_TIMEOUT_MS` gain one more consumer each. The JSON body parser
  (`app.useBodyParser('json', …)` in `apps/chat-api/src/main.ts`) must not
  consume the stream — the endpoint accepts only `application/octet-stream`
  (`415` otherwise).
- **OpenAPI / generated client**: one new operation; `npm run openapi`,
  `openapi:check`, regenerate `libs/chat-api-client`. No existing operation
  changes.
- **`libs/chat-hooks`**: `createUploadFileWithProgress` + new exported enum
  `UploadBodyEncoding`; README section updated. Library isolation holds: the
  upload URL and the encoding choice are still supplied by the host adapter
  (`apps/chat/src/server-api/upload-file-with-progress.ts`); the lib only knows
  the query-field names it already sends today as form fields.
- **i18n**: no new user-visible strings; `411`/`415` are programmer errors and
  map to the existing generic failure reason.
- **Deployment**: BFF pods no longer need ephemeral storage for file-manager
  uploads. An nginx ingress with `proxy-request-buffering: on` (default) still
  buffers the body at the ingress; set it `off` for the BFF upload route to get
  end-to-end streaming.
- **Rollback**: revert the `apps/chat` adapter to `Multipart` +
  `/api/v1/files`; the new endpoint can stay unused.

## Acceptance criteria

- A 500 MB file uploaded from the file manager succeeds with the BFF writing
  nothing to `os.tmpdir()` and BFF RSS not growing with file size (unit test
  asserts no `diskStorage`/temp file; manual check on dev with a throttled
  400–500 MB upload).
- The PUT to DIAL Core carries `Content-Length = preamble + N + epilogue` and no
  `Transfer-Encoding: chunked`.
- `Content-Length` over `FILE_UPLOAD_MAX_BYTES` → `413` without reading the
  body; missing → `411`; non-octet-stream → `415`; invalid query → `400`.
- Browser abort mid-transfer aborts the Core request; stall / no response /
  30 min ceiling → `503` with the existing cause messages.
- `POST /api/v1/files` behaviour and its tests are unchanged.
- `chat-api`, `@epam/ai-dial-chat-hooks`, `@epam/chat` tests/lint pass;
  `openapi:check`, `validate:docs`, `validate:specs` pass.
