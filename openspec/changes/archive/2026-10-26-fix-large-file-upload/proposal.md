## Why

Uploading a file larger than ~100 MB from the file manager still fails after
#9423 (issue #9398, re-opened by QA with a 250 MB file). #9423 only bounded the
BFF → DIAL Core leg by progress; the browser → BFF leg is still cut by Node's
default `server.requestTimeout` (300 000 ms — verified: a body that keeps
flowing past it gets `408` and the socket is closed), which the browser reports
as a network error. On top of that the file manager tells the user "Please
check your internet connection" for *every* failed batch, so the real cause is
invisible, and since #9423 the streamed PUT carries no `Content-Length`, so
DIAL Core's own `storage.maxUploadedFileSize` (default 512 MB, checked only
against `Content-Length` in Core's `Proxy`) is silently bypassed.

## Problem

1. `apps/chat-api/src/main.ts` never sets `requestTimeout`; any upload that
   takes longer than 5 minutes to reach the BFF (100 MB needs ≥ 2.7 Mbit/s,
   250 MB ≥ 6.7 Mbit/s) is aborted with `408`.
2. `POST /api/v1/files` buffers the whole file in memory (`memoryStorage()` in
   `apps/chat-api/src/files/files.module.ts:24`); multer's `Buffer.concat` peaks
   at ~2× the file size per upload, which risks an OOM kill of the pod under a
   few concurrent large uploads.
3. `FileManagerNotificationReason.UploadFailed` always maps to
   `dialFileManager.checkInternetConnection`
   (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts:129`),
   whatever the HTTP status was.
4. The streamed PUT to DIAL Core is chunked (no `Content-Length`), so Core's
   `maxUploadedFileSize` check sees its 1024-byte default and never fires — a
   deployment that lowered the Core limit no longer gets it enforced.
5. A server-side `413` shows "The file is too large to upload" with no limit,
   while the client-side pre-check already says "Max file size is {{maxSize}}."

## Solution

- **BFF request receive timeout**: set the Node HTTP server's `requestTimeout`
  to the existing 30-minute upload ceiling (`UPLOAD_MAX_DURATION_MS`), leaving
  `headersTimeout` at its default.
- **Disk staging for single-file upload**: `POST /api/v1/files` stages the file
  to `os.tmpdir()` with multer `diskStorage` through an interceptor that shares
  its implementation with `ArchiveUploadInterceptor`
  (`apps/chat-api/src/files/archive-upload.interceptor.ts`), streams it from
  disk to DIAL Core, and deletes it when the request finishes.
- **Exact `Content-Length` to DIAL Core**: the multipart envelope is
  deterministic, so the BFF computes its byte length from the file size and
  sends it on every streamed PUT (single files and archive entries). Core's
  413 maps to the BFF's existing `413`.
- **Reason-aware failure toast**: `useDialFileUploadBatch` reports the shared
  failure reason of an all-failed batch on the `UploadFailed` notification;
  the app adapter picks the matching message and keeps "check your internet
  connection" for `Network` only.
- **Limit shown on 413**: the too-large queue row and toast use
  `dialFileManager.uploadFileTooLarge` ("Max file size is {{maxSize}}.") with
  the limit from `AppConfig.config.maxAttachmentFileSizeBytes`, which is
  already sourced from `FILE_UPLOAD_MAX_BYTES` (config registry key
  `attachments.maxFileSizeBytes`). No new environment variable is needed: the
  one variable already drives the multer limit, the client pre-check, and now
  the post-413 message.

Alternatives considered:

- *Raise only `requestTimeout`* (conservative baseline) — fixes the QA case but
  leaves the 2× memory peak, the misleading toast and the bypassed Core limit.
- *Pure pass-through streaming (busboy → Core, no staging)* — lowest memory and
  disk, but the client appends `file` before `bucket`/`path`, so the file
  would reach Core before the DTO is validated, and the file size (needed for
  `Content-Length`) is unknown until the part ends. Rejected.
- *Make `requestTimeout` an environment variable* — no operator need yet;
  it mirrors the fixed 30-minute ceiling the spec already declares. Rejected.

## Non-goals

- Resumable / chunked (multi-request) uploads.
- Changing the conversation-input attachment upload path (it already pre-checks
  the size with `attachments.fileTooLarge.message` and its `{{maxSize}}`).
- Configuring ingress / reverse-proxy limits (`proxy-body-size`,
  `proxy-read-timeout`) — deployment concern, documented only.

## What Changes

- `apps/chat-api/src/main.ts` (via a small extracted helper) sets
  `requestTimeout` on the HTTP server.
- `POST /api/v1/files` switches from `memoryStorage` to disk staging; the
  `MulterModule` registration in `FilesModule` is removed. The upload
  `UploadedFile` shape gains a disk-backed variant (the zero-byte folder marker
  keeps the in-memory variant).
- `UploadWatchdog.watch` accepts an async chunk source (the disk read stream).
- Every streamed PUT to DIAL Core carries an exact `Content-Length`.
- `FileManagerNotification` (`@epam/ai-dial-chat-hooks`) gains an optional
  `failureReason`; `useDialFileUploadBatch` sets it on `UploadFailed` when every
  failed file shares one reason.
- App adapter + `useUploadQueueLabels` render reason-specific messages and the
  max size.
- One new i18n key for the "mixed/unknown reasons" toast body.

No API contract change (`POST /api/v1/files` keeps its request/response shapes
and status codes); not breaking.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `file-upload`: request receive timeout; disk staging replaces the
  "MUST NOT store on disk / memoryStorage" requirement; exact
  `Content-Length` to DIAL Core and Core `413` passthrough.
- `file-manager-upload`: the total-failure toast follows the failure reason;
  the too-large row and toast show the configured maximum size.
- `chat-hooks-file-manager-upload`: `UploadFailed` carries the batch's shared
  `failureReason`.

## Impact

- **Backend** (`apps/chat-api`): `main.ts`, `files/files.module.ts`,
  `files/files.controller.ts`, `files/archive-upload.interceptor.ts` (+ new
  shared interceptor), `files/upload/files-upload.service.ts`,
  `files/upload/upload-watchdog.ts`, `files/files.service.ts`, tests, README.
  Temp disk use: up to `FILE_UPLOAD_MAX_BYTES` per in-flight upload in
  `os.tmpdir()` — the same footprint `upload-archive` already has.
- **Libs**: `libs/chat-hooks` (`FileManagerNotification` type,
  `useDialFileUploadBatch`, README). Host knowledge stays out of the lib: it
  reports a structured `FileUploadFailureReason` (already defined in
  `@epam/ai-dial-chat-shared`); the app resolves strings and the size limit.
- **App** (`apps/chat`): notification adapter, `useDialFileManagerHostOptions`,
  `useUploadQueueLabels`, `en.json` + `translation-keys.ts`.
- **i18n**: new `dialFileManager.uploadFailedSeeQueue`; existing
  `dialFileManager.uploadFileTooLarge` reused for the 413 path.
- **Docs**: `apps/chat-api/README.md` (`FILE_UPLOAD_MAX_BYTES` vs Core
  `storage.maxUploadedFileSize`, temp disk, receive timeout).

## Rollback

Revert the commit. No data migration, no contract change; the generated client
is unaffected.

## Acceptance criteria

- A request whose body keeps flowing for longer than 5 minutes is not cut by
  the BFF (unit test on the server config; manual check with a throttled
  250 MB upload).
- `POST /api/v1/files` no longer holds the file in memory; the temp file is
  removed on success, on DIAL Core error, and on multer rejection.
- The PUT to DIAL Core carries `Content-Length` equal to the bytes sent; a Core
  `413` yields BFF `413`.
- An all-failed batch shows a toast whose body matches the failure reason;
  `Network` alone shows "check your internet connection".
- A `413` row and toast read "Max file size is 512 MB." with the default
  config.
- `nx test`/`lint` for `chat-api`, `chat-hooks`, `chat`; `npm run validate:docs`
  and `npm run validate:specs` pass.
