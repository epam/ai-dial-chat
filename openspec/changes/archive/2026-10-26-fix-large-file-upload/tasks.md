Slicing strategy: **risk-first**. Slice 1 removes the confirmed cause of the QA
failure (Node's 5-minute `requestTimeout`) and ships value on its own. Slices 2–3
change the BFF upload transport (disk staging, then `Content-Length`), each
verifiable with `chat-api` tests alone. Slices 4–5 are the UI wording, lib first
so the app slice can consume the new field.

## 1. BFF receive timeout

- [x] 1.1 Add `configureHttpServerTimeouts(server: http.Server)` in `apps/chat-api/src/common/utils/http-server-timeouts.ts` that sets `requestTimeout = UPLOAD_MAX_DURATION_MS` (imported from `apps/chat-api/src/files/upload/upload-watchdog.ts`) and leaves `headersTimeout` alone; JSDoc says why (Node default 300 000 ms cuts slow uploads with 408)
- [x] 1.2 Call it in `apps/chat-api/src/main.ts` on `app.getHttpServer()` right after `NestFactory.create`
- [x] 1.3 Unit test `apps/chat-api/src/common/utils/http-server-timeouts.spec.ts`: a server gets `requestTimeout === UPLOAD_MAX_DURATION_MS` and its default `headersTimeout`; a body that keeps flowing past Node's former default is not answered with 408 (use a reduced timeout via a real `http.createServer` to keep the test fast, or assert the property only if the behavioural test is flaky)
- [x] 1.4 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`

## 2. Disk staging for `POST /api/v1/files`

- [x] 2.1 Extract `DiskFileUploadInterceptor` (abstract, `apps/chat-api/src/files/disk-file-upload.interceptor.ts`) from `ArchiveUploadInterceptor`: max-bytes config key + 413 message as abstract members; keep the diskStorage/limits/error-mapping/temp-file removal logic byte-for-byte
- [x] 2.2 Make `ArchiveUploadInterceptor` (`apps/chat-api/src/files/archive-upload.interceptor.ts`) a subclass (`ARCHIVE_UPLOAD_MAX_BYTES`, `'Archive payload too large'`) — behaviour unchanged
- [x] 2.3 Add `FileUploadInterceptor` (`apps/chat-api/src/files/file-upload.interceptor.ts`, `FILE_UPLOAD_MAX_BYTES`, `'File too large'`), register it in `FilesModule` providers, and use it on `uploadFile` in `apps/chat-api/src/files/files.controller.ts` instead of `FileInterceptor('file')`; the handler receives `Express.Multer.File` and passes `{ path, size, mimetype, originalname }`
- [x] 2.4 Delete the `MulterModule.registerAsync` block and the `memoryStorage` import from `apps/chat-api/src/files/files.module.ts`
- [x] 2.5 In `apps/chat-api/src/files/upload/files-upload.service.ts`, replace `UploadedFile` with the `StagedUploadFile | BufferedUploadFile` union (design D2); `uploadFile` reads a staged file with `createReadStream(path, { highWaterMark: UPLOAD_CHUNK_BYTES })` and a buffered one with `sliceBuffer`; update the re-typed parameter in `apps/chat-api/src/files/files.service.ts`. `apps/chat-api/src/files/folder/files-folder.service.ts` keeps its zero-byte buffer marker
- [x] 2.6 Widen `UploadWatchdog.watch` in `apps/chat-api/src/files/upload/upload-watchdog.ts` to `AsyncIterable<Buffer> | Iterable<Buffer>`
- [x] 2.7 Tests: `apps/chat-api/src/files/tests/upload/upload-watchdog.spec.ts` (async source resets the idle timer per chunk); `apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts` (staged file streams byte-for-byte from disk; buffered marker still works); `apps/chat-api/src/files/tests/files.controller.spec.ts` exercises the real `FileUploadInterceptor` through supertest — 201 with a staged `{ path, size }`, oversized → 413 `File too large`, missing `file` field → 400 `file is required` (same as `upload-archive`), temp file removed after success and after a handler error. Cleanup of a partially written file after a multer rejection is multer 2.4's own `abortWithError` removal and is not asserted separately
- [x] 2.8 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 3. Exact `Content-Length` to DIAL Core

- [x] 3.1 In `uploadFileStream` (`files-upload.service.ts`) take a required `fileSize`, build preamble/epilogue buffers once, and send `Content-Length = preamble + fileSize + epilogue` with the streamed body; callers pass `file.size` / `buffer.length` / the archive entry's staged `entryBytes`
- [x] 3.2 Tests in `files-upload.service.spec.ts`: header equals the bytes the mock receives for single files and archive entries; a Core `413` becomes `PayloadTooLargeException`; one real `node:http` server test asserts the request arrives with `content-length` and without `transfer-encoding`
- [x] 3.3 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`

## 4. Lib: failure reason on `UploadFailed`

- [x] 4.1 Add `failureReason?: FileUploadFailureReason` (with JSDoc) to `FileManagerNotification` in `libs/chat-hooks/src/files/dial-file-manager.types.ts`
- [x] 4.2 In `libs/chat-hooks/src/files/useDialFileUploadBatch/useDialFileUploadBatch.ts` collect the resolved reason of every failed file and set `failureReason` on `UploadFailed` only when all are equal
- [x] 4.3 Tests in `libs/chat-hooks/src/files/useDialFileUploadBatch/tests/useDialFileUploadBatch.spec.tsx`: uniform reason forwarded; mixed reasons → unset; partial success → `UploadCompleted` without `failureReason`
- [x] 4.4 Architecture guard: the change adds no strings, size limit, config, `/api` path, i18n, or app import to `libs/chat-hooks`; update `libs/chat-hooks/README.md` where `FileManagerNotification` fields are listed
- [x] 4.5 Verify: `npm exec nx test chat-hooks`, `npm exec nx lint chat-hooks`, `npm run validate:docs`

## 5. App: reason-specific toast and the size limit

- [x] 5.1 i18n: add `dialFileManager.uploadFailedSeeQueue` ("Check the upload list for details.") to `apps/chat/src/i18n/locales/en.json` and `UploadFailedSeeQueue` to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (`en.json` is the only locale file)
- [x] 5.2 `buildFileManagerNotificationOptions` in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`: accept `{ maxUploadSize?: string }` and map `UploadFailed` by `failureReason` per the `file-manager-upload` table
- [x] 5.3 `useDialFileManagerHostOptions` (`apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`): read `useAppConfig().config.maxAttachmentFileSizeBytes`, format with `formatFileSize` when positive, memoise, and pass it to the adapter
- [x] 5.4 `useUploadQueueLabels` (`apps/chat/src/hooks/files/useUploadQueueLabels.ts`): `TooLarge` row message uses `dialFileManager.uploadFileTooLarge` with the same `maxSize`, falling back to `dialFileManager.uploadFailedTooLarge`
- [x] 5.5 Tests: `apps/chat/src/components/DialFileManagerShell/tests/file-manager-notification-adapter.spec.ts` (one case per reason + mixed + TooLarge fallback); `apps/chat/src/hooks/files/tests/useUploadQueueLabels.spec.ts` (TooLarge shows "Max file size is 512 MB."); fix `DialFileManagerPage`/`DialFileManagerModal` specs if their `useAppConfig` mocks need the field
- [x] 5.6 RTL/a11y: no new elements; confirm the toast and row texts render through existing components (no physical-direction classes added)
- [x] 5.7 Verify: `npm exec nx test chat`, `npm exec nx lint chat`

## 6. Docs and specs

- [x] 6.1 `apps/chat-api/README.md`: `FILE_UPLOAD_MAX_BYTES` — staged to `os.tmpdir()` (size ephemeral storage for concurrent uploads), keep it ≤ DIAL Core `storage.maxUploadedFileSize`, and the 30-minute request receive timeout; mention ingress `proxy-body-size` / `proxy-read-timeout` as deployment prerequisites
- [x] 6.2 Verify: `npm run validate:docs`, `npm run validate:specs`, `npm run spec:impact`

## 7. Follow-ups (out of scope, record only)

- [x] 7.1 Note in the PR: conversation-input attachment uploads (`libs/conversation-input`) do not map a server `413` to `AttachmentErrorReason.FileTooLarge`; the pre-upload check already shows the limit
- [x] 7.2 Note in the PR: `apps/chat-api/src/skills/import/skill-archive-upload.interceptor.ts` may be able to reuse `DiskFileUploadInterceptor`
- [x] 7.3 Note in the PR: `apps/chat-api/README.md` contains its whole body four times (pre-existing); this change updates the `FILE_UPLOAD_MAX_BYTES` row in every copy and leaves the de-duplication to a separate change
