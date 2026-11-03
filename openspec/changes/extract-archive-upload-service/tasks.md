Slicing: vertical, inside-out. First the pure helpers move, with their tests. Then the archive pipeline moves into its own service, the facade and module are wired, and its tests move. `chat-api` must be green after each slice. All paths are under `apps/chat-api/src/files/`. Relative imports are extensionless. Nothing outside `files/` changes except this change's OpenSpec folder.

## 1. Pure archive helpers → `upload/archive-upload.ts`

- [x] 1.1 Create `upload/archive-upload.ts` and move into it unchanged, as exported arrow functions (design D2):
  - `ArchiveEntryPathResult`;
  - `resolveArchiveEntryPath`, previously a method;
  - `decodeArchiveEntryName`, previously a method;
  - `buildDeduplicatedFilePath`, with private `splitFilePath`/`buildDeduplicatedFileName` and `DIAL_RESOURCE_SEGMENT_BYTE_LIMIT`;
  - `ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT`, `isConflictError` and `throwIfArchiveUploadAborted`.

  Import them in `upload/files-upload.service.ts` and remove the originals.
- [x] 1.2 Move `describe('resolveArchiveEntryPath')` from `tests/upload/files-upload.service.spec.ts` to a new `tests/upload/archive-upload.spec.ts`, calling the module function. The cases and expectations stay the same.

Verification: `npm run test:file -- apps/chat-api/src/files/tests/upload/archive-upload.spec.ts apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts`

## 2. `FilesArchiveUploadService`

- [x] 2.1 Create `upload/files-archive-upload.service.ts` with `@Injectable() FilesArchiveUploadService(configService, filesUploadService)` and a JSDoc summary (design D1).
  - Move unchanged: `ArchiveFileEntry`, `uploadArchive`, `extractAndUploadArchive`, `uploadArchiveEntryWithDeduplicatedName`, `stageArchiveEntryToTemp`, `uploadArchiveEntryFromTemp` (now calling `this.filesUploadService.uploadFileStream`) and `removeArchiveUploadTempDirectory`.
  - Remove them from `FilesUploadService`.
  - Make `uploadFileStream` public, with JSDoc naming both callers, and export `StreamUploadOptions`.
- [x] 2.2 Wire the new service:
  - `files.module.ts` `providers`;
  - `files.service.ts`: append the `filesArchiveUploadService` constructor parameter and delegate `uploadArchive` to it (design D3);
  - `tests/files.controller.spec.ts`: one more constructor argument.
- [x] 2.3 Move `describe('uploadArchive')` unchanged, with the helpers it uses, to a new `tests/upload/files-archive-upload.service.spec.ts`. Use a setup that returns `{ service, sdkClient, fetchCore }` with `service` being the archive service (design D4).

Verification: `npm run test:file -- apps/chat-api/src/files/tests/upload/files-archive-upload.service.spec.ts apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts apps/chat-api/src/files/tests/files.controller.spec.ts apps/chat-api/src/files/tests/folder/files-folder.service.spec.ts`

## 3. Close

- [x] 3.1 Remove unused imports. Confirm the line counts: `files-upload.service.ts` < 450, `files-archive-upload.service.ts` about 400 (394; the target was revised from < 350). Confirm `files-upload.service.ts` has no `yauzl`/`mkdtemp`/`ARCHIVE_UPLOAD_*` env references. The `ARCHIVE_UPLOAD_ABORTED` error text in `uploadFileStream` predates this change and stays.
- [x] 3.2 Confirm the moved tests keep the same number of `it` cases, and that the total across the two upload specs and the new spec equals the original.
- [x] 3.3 `npm exec nx run-many -- -t test lint build typecheck -p chat-api --excludeTaskDependencies --parallel=1` passes.
- [x] 3.4 `npm run openapi:check` reports no diff, and `npm run validate:specs` passes.
- [ ] 3.5 Run `npm run verify:full` once.

## 4. Follow-up (out of scope)

- [ ] 4.1 Rename `throwIfArchiveUploadAborted` to an upload-neutral name in its own change, deciding whether single-file uploads should keep the `Archive upload timed out` message.
- [ ] 4.2 Propose `split-environment-config` (refactoring plan B6).
