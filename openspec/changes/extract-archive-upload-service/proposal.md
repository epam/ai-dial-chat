## Why

`apps/chat-api/src/files/upload/files-upload.service.ts` is 812 lines and is item B5 (P2) of the 2026-10-26 refactoring audit. It holds two features that share one transport:

- **Single-file upload:** `uploadFile`, the multipart envelope and the raw `fetchCore` `PUT` (`uploadFileStream`), with the upload watchdog.
- **ZIP archive upload, about 400 lines:**
  - limits and the timeout;
  - the two-pass central-directory scan;
  - per-entry temp staging under an uncompressed budget;
  - conflict renaming with up to 50 ` (n)` retries;
  - temp-directory cleanup;
  - the zip-slip `resolveArchiveEntryPath`;
  - the UTF-8-byte-safe deduplicated file name helpers.

Archive changes, such as limits, conflict policy and path safety, have to be read past the single-file transport, and the reverse is true as well. The file is about twice the `files-service-decomposition` limit of about 400 lines per non-test file. Its 1103-line spec mixes both features too.

## What Changes

- **New pure module `apps/chat-api/src/files/upload/archive-upload.ts`.** It holds the archive helpers that need no injected dependency, moved unchanged:
  - `resolveArchiveEntryPath` (now a module function, previously a public method) and `ArchiveEntryPathResult`;
  - `decodeArchiveEntryName`;
  - `buildDeduplicatedFilePath` with its `splitFilePath`/`buildDeduplicatedFileName` helpers and the `DIAL_RESOURCE_SEGMENT_BYTE_LIMIT`/`ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT` constants;
  - `isConflictError`;
  - `throwIfArchiveUploadAborted`.
- **New `FilesArchiveUploadService`** (`apps/chat-api/src/files/upload/files-archive-upload.service.ts`, injectable). It takes `ConfigService` and `FilesUploadService` and owns, moved unchanged:
  - `uploadArchive`;
  - `extractAndUploadArchive`;
  - `uploadArchiveEntryWithDeduplicatedName`;
  - `stageArchiveEntryToTemp`;
  - `uploadArchiveEntryFromTemp`;
  - `removeArchiveUploadTempDirectory`.

  It reaches DIAL Core only through `FilesUploadService.uploadFileStream`.
- **`FilesUploadService`** keeps `uploadFile` and the transport. `uploadFileStream` becomes public, with JSDoc, keeping its name, which the specs cite. `StreamUploadOptions` is exported. The file shrinks to about 440 lines.
- **`FilesService`** (the facade) injects `FilesArchiveUploadService` and delegates `uploadArchive` to it. **`files.module.ts`** registers the new provider. The controller does not change.
- **Tests:**
  - `describe('resolveArchiveEntryPath')` moves to `tests/upload/archive-upload.spec.ts` and calls the module function; the assertions do not change.
  - `describe('uploadArchive')` moves to `tests/upload/files-archive-upload.service.spec.ts`, with assertions and mocks unchanged and a setup helper that builds both services.
  - The `new FilesService(...)` call in `tests/files.controller.spec.ts` gains one argument.

No behavior changes:

- the same endpoint, DTOs, OpenAPI, env vars and limits;
- the same error statuses and messages (`Archive upload timed out` and the others);
- the same per-entry results and conflict renaming;
- the same temp cleanup and log text.

### Non-goals

- Changing archive limits, conflict policy or path-safety rules.
- Splitting the single-file transport further.
- Moving `files-archive-download.service.ts`, which sits in `archive/`. That folder holds downloads, while this change keeps upload code together in `upload/`.
- Rewriting the moved tests.

### Acceptance criteria

- `files-upload.service.ts` is under 450 lines and contains no `yauzl`, `mkdtemp`, archive limit or conflict-retry code.
- `files-archive-upload.service.ts` is under 350 lines. `archive-upload.ts` has no Nest provider and no I/O.
- Every moved test passes from its new file with the same assertions, and all other `files` specs pass. `npm exec nx test chat-api`, `lint` and `build` pass. `npm run openapi:check` reports no diff.

### Alternatives considered

1. **Pure helpers only** (baseline): move the path and name helpers out and keep the class. The extraction pipeline stays in the transport class, and the file stays around 730 lines. Rejected because it does not reach the size limit.
2. **`FilesArchiveUploadService` on top of `FilesUploadService` plus a pure module** (chosen). It matches the precedent of `FilesFolderService`, which already injects `FilesUploadService` for its marker write. There is one transport, and the dependency points one way.
3. **Move archive upload under `archive/`, next to the download.** Rejected: that folder is download-only. Keeping both upload paths in `upload/` keeps the shared transport and its watchdog local.

### Rollback

The change is internal to `chat-api`. Reverting the commit restores it, with no contract, env or data migration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `files-service-decomposition`: "Files domain service ownership map" gains `FilesArchiveUploadService`. The count becomes eight services, and `FilesUploadService`'s entry loses archive upload.
- `file-manager-upload-archive`: "POST /api/v1/files/upload-archive endpoint" and "Upload-archive observability" name `FilesArchiveUploadService` as the owner of archive extraction, `uploadArchive` and its log lines. Single-file upload stays with `FilesUploadService`.

## Impact

- **Code:** `apps/chat-api/src/files/`.
  - New: `upload/archive-upload.ts` and `upload/files-archive-upload.service.ts`.
  - Edited: `upload/files-upload.service.ts`, `files.service.ts` and `files.module.ts`.
- **Tests:**
  - New: `tests/upload/archive-upload.spec.ts` and `tests/upload/files-archive-upload.service.spec.ts`.
  - Edited: `tests/upload/files-upload.service.spec.ts` (the blocks move out) and `tests/files.controller.spec.ts` (constructor arity).
- **Docs:** `apps/chat-api/src/skills/utils/skill-path.util.ts` cites `resolveArchiveEntryPath` in a comment, and the name stays valid. No `docs/` file names these internals.
- **Unaffected:**
  - endpoints, OpenAPI and the generated client;
  - the frontend and libs;
  - the env vars (`ARCHIVE_UPLOAD_*`, `FILE_TRANSFER_TIMEOUT_MS`);
  - i18n: no new strings;
  - RTL and a11y, feature gating and telemetry.
