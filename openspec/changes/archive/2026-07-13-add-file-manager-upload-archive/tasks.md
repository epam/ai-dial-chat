## 1. Dependency and environment configuration

- [x] 1.1 Add `yauzl` and `@types/yauzl` as direct dependencies in `apps/chat-api/package.json`
- [x] 1.2 Add `ARCHIVE_UPLOAD_MAX_BYTES` (default `536_870_912`), `ARCHIVE_UPLOAD_MAX_FILES` (default `1000`), `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` (default `2_147_483_648`), `ARCHIVE_UPLOAD_TIMEOUT_MS` (default `300_000`) to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), each `@IsOptional @IsInt @Min(1)` with `@Transform(({value}) => parseInt(value, 10))`, matching the existing numeric env var pattern
- [x] 1.3 Add placeholder entries for the four new vars to `.env.example` and document them in `apps/chat-api/README.md`
- [x] 1.4 Write a config validation test confirming the app fails fast at boot when one of the four vars is set to a non-numeric value
- [x] 1.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 2. BFF — DTOs and path-safety validation

- [x] 2.1 Create `UploadArchiveDto` / `UploadArchiveEntryResultDto` / `UploadArchiveResponseDto` in `apps/chat-api/src/files/dto/upload-archive.dto.ts` (bucket/destinationPath fields with the same validators as `CopyItemDto`'s bucket/path fields)
- [x] 2.2 Add a private path-safety helper to `FilesService` (or a shared util if one already exists for path validation) that rejects an entry name if it is absolute, contains a `..` segment after normalization, or contains a backslash; returns whether the entry is a directory entry (to be skipped silently)
- [x] 2.3 Write unit tests for the path-safety helper: rejects `../../etc/passwd`, rejects `/etc/passwd`, rejects `C:\Windows\...`, accepts `reports/2026/q1.pdf`, identifies directory entries (trailing `/`) for silent skipping
- [x] 2.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 3. BFF — uploadArchive service method

- [x] 3.1 Add `FilesService.uploadArchive(bucket: string, destinationPath: string, archiveFile: { buffer: Buffer }, token: string): Promise<UploadArchiveResponseDto>`: open the buffer with `yauzl.fromBuffer` in lazy-entries mode, iterate entries via `readEntry()`/`entry` events
- [x] 3.2 For each entry: skip directory entries silently (task 2.2's helper); reject unsafe paths as a failed result with `error: "Invalid path"` (no upload attempted); enforce `ARCHIVE_UPLOAD_MAX_FILES` (abort once the non-directory entry count exceeds it, throw `UnprocessableEntityException`) and `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` (track cumulative bytes read from each entry's decompression stream as it streams, destroy the stream and throw `UnprocessableEntityException` once exceeded)
- [x] 3.3 For each valid entry, read its decompressed contents into a buffer and call `this.uploadFile(bucket, destinationPath + '/' + entryRelativePath, { buffer, mimetype: 'application/octet-stream' }, token, 'create-only')`; map a 409 from that call to `{ success: false, error: "Conflict" }` in the entry's result, any other thrown exception to `{ success: false, error: <message> }`, success to `{ success: true }`
- [x] 3.4 Wrap the whole extraction loop with `AbortSignal.timeout(ARCHIVE_UPLOAD_TIMEOUT_MS)`-equivalent wall-clock budget (reuse the existing timeout-handling pattern from `downloadArchive`/`getTimeoutMs()` if applicable), throwing `ServiceUnavailableException` on timeout
- [x] 3.5 Add structured `logger.log` at start (`entryCount` once known) and end (`successCount`/`failedCount`) — no file names, paths, or archive contents in log lines
- [x] 3.6 Write unit tests in `apps/chat-api/src/files/tests/files.service.spec.ts`: all-entries-succeed, empty archive returns empty results, non-ZIP buffer throws a validation error, entry-count limit exceeded throws `UnprocessableEntityException` with zero uploads attempted after the limit, cumulative-uncompressed-bytes limit exceeded aborts mid-extraction with prior successful uploads retained, one entry conflicts (409 → `"Conflict"`) while others still succeed, path-traversal entries rejected without upload attempts, timeout throws `ServiceUnavailableException`
- [x] 3.7 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 4. BFF — controller route

- [x] 4.1 Add `@Post('upload-archive') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60000 } }) @UseInterceptors(FileInterceptor('file')) @ApiConsumes('multipart/form-data')` route to `FilesController`, mirroring the existing `POST /api/v1/files` multipart pattern, with an explicit `@ApiBody` schema (`file`/`bucket`/`destinationPath`) and full `@ApiResponse` decorators (200/400/401/413/422/429/502/503); delegate to `FilesService.uploadArchive`
- [x] 4.2 Write controller tests in `apps/chat-api/src/files/tests/files.controller.spec.ts`: valid multipart request, missing `file` field (400), missing/invalid `bucket`/`destinationPath` (400), unauthenticated (401), oversized body (413 — via the existing multipart body-size limit middleware/config)
- [x] 4.3 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 5. OpenAPI client regeneration and server-api wrapper

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client/`; verify `filesApi.uploadArchive` appears with a clean generated name and correct multipart request typing
- [x] 5.2 Run `npm run openapi:check`
- [x] 5.3 Add `uploadArchive(file: File, bucket: string, destinationPath: string): Promise<UploadArchiveResponseDto>` thin wrapper in `apps/chat/src/server-api/files.api.ts`, following the multipart-request shape already used by the existing single-file `uploadFile` wrapper
- [x] 5.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — both must pass

## 6. Hook — onUploadArchive

- [x] 6.1 Add `onUploadArchive(file: File, name: string, destinationFolder: string)` `useCallback` to `useDialFileManager`, resolving `destinationFolder` to `{ bucket, destinationPath }` via the same resolution `onUploadFiles` already uses, then calling the new `uploadArchive` server-api wrapper
- [x] 6.2 Reuse the hook's existing `uploadBatchState` to represent the in-flight archive upload as a single indeterminate item (no new progress-state shape)
- [x] 6.3 On completion: full success invalidates the destination folder's cache entry and increments `retryCounter` with no toast; partial failure shows a toast via `onNotification(NotificationVariant.Error, ...)` with `DialFileManagerI18nKeys.UploadArchivePartialError` and the failed count; full request failure shows a toast via `DialFileManagerI18nKeys.UploadArchiveError`
- [x] 6.4 Write unit tests for `onUploadArchive`: success (cache invalidated, no toast), partial failure (toast with count), full failure (toast), correct bucket/destinationPath resolution
- [x] 6.5 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 7. Shell wiring

- [x] 7.1 Pass `onUploadArchive` from `useDialFileManager`'s result through `DialFileManagerShell` to the underlying `DialFileManager.onUploadArchive` prop
- [x] 7.2 Populate `toolbarOptions.newActions.uploadArchive` (label + icon) only when `variant === DialFileManagerVariant.Standalone`, the active tab is `my_files`, `uploadEnabled` is `true`, and `actionProfile === DialFileManagerActionProfile.Full` — absent on `shared`/`organization` tabs and in the attach modal, per the updated `file-manager-tabs` spec
- [x] 7.3 Add `uploadArchiveAction` label to `DialFileManagerShellLabels`
- [x] 7.4 Write/extend shell tests: toolbar entry present only under the exact gating conditions above; absent on `shared`/`organization`, absent in attach modal, absent without WRITE permission
- [x] 7.5 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass

## 8. Standalone page profile switch

- [x] 8.1 Change `DialFileManagerPage`'s `useDialFileManager` call from `actionProfile: DialFileManagerActionProfile.Browse` to `actionProfile: DialFileManagerActionProfile.Full`
- [x] 8.2 Confirm (via existing/extended tests) that the standalone page now surfaces Share/Unshare/Remove access (from `add-file-manager-sharing`), Info (from `add-file-manager-metadata-ui`), and upload-archive (this change) in addition to the previously-shipped Browse matrix
- [x] 8.3 Confirm the attach modal's `actionProfile` remains `Attach`, unaffected by this switch
- [x] 8.4 Run `npm exec nx test chat` — must pass with the new `Full`-profile assertions

## 9. i18n and RTL

- [x] 9.1 Add the three i18n keys listed in `specs/file-manager-upload-archive/spec.md` (`uploadArchiveAction`, `uploadArchiveError`, `uploadArchivePartialError`) to `apps/chat/src/i18n/locales/en.json`
- [x] 9.2 Add matching enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 9.3 RTL check: confirm no new physical-direction Tailwind classes are introduced by the toolbar entry (ui-kit-owned chrome); the upload-archive toolbar icon, if any, is symmetric and needs no `rtl:` mirroring

## 10. Full verification and roadmap closeout

- [x] 10.1 Update the local #7504 gap matrix (referenced in the parent proposal) to mark rows 31, 40, 41, 42, and 53 as done
- [x] 10.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 10.3 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass
- [x] 10.4 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
- [x] 10.5 Confirm `npm run openapi:check` is clean for the final combined state of all three #7504 changes
