## 1. Scaffolding (no behavior moved yet)

- [x] 1.1 Create the new subfolders under `apps/chat-api/src/files/`: `listing/`, `upload/`, `folder/`, `download/`, `archive/`, `sharing/`, `batch/`.
- [x] 1.2 Add empty/skeleton `FilesListingService`, `FilesUploadService`, `FilesFolderService`, `FilesDownloadService`, `FilesArchiveDownloadService`, `FilesSharingService`, `FilesBatchOperationsService`, each `@Injectable()` and constructor-injecting `DialClientService` (and `ConfigService<EnvironmentVariables>` where the moved methods will need it).
- [x] 1.3 Register all seven new services as providers in `files.module.ts`; leave `FilesService` untouched.
- [x] 1.4 Run `npm exec nx build chat-api` to confirm the new providers wire up with no DI errors.

## 2. Extract FilesListingService (including shared folder traversal)

- [x] 2.1 Move `listFiles`, `listPublicFiles`, `listSharedFiles`, `listSharedByMe`, `getFileMetadata`, and the private `fetchFileMetadataPage` helper into `FilesListingService`.
- [x] 2.2 Move `expandFolderContents`, `buildArchivePath`, `getRelativeChildPath`, `toRelativePath`, and the module-level `safeDecodePathForCompare` helper into `FilesListingService` alongside the listing methods (these become the shared folder-traversal primitive other new services will inject this service for).
- [x] 2.3 Update `FilesService` to inject `FilesListingService` and delegate each moved public method to it, keeping its own method signatures unchanged.
- [x] 2.4 Create `apps/chat-api/src/files/tests/listing/files-listing.service.spec.ts`, moving the `listFiles`, `listPublicFiles`, `listSharedFiles`, `listSharedByMe`, `expandFolderContents`, `buildArchivePath`, `resolveArchiveEntryPath` (if applicable), and `getFileMetadata` `describe` blocks from `files.service.spec.ts` verbatim (same assertions, updated instantiation to construct `FilesListingService` directly).
- [x] 2.5 Run `npm exec nx test chat-api` — confirm all relocated and remaining tests pass.

## 3. Extract FilesDownloadService and FilesSharingService

- [x] 3.1 Move `downloadFile` into `FilesDownloadService`; update `FilesService` to delegate.
- [x] 3.2 Move `shareFiles`, `revokeAccess`, `discardShared` (and their private helpers `mapSharePermission`, `buildDialFileResourceUrl` usage) into `FilesSharingService`; update `FilesService` to delegate.
- [x] 3.3 Create `apps/chat-api/src/files/tests/download/files-download.service.spec.ts` and `apps/chat-api/src/files/tests/sharing/files-sharing.service.spec.ts`, relocating the corresponding `describe` blocks (`downloadFile`, `shareFiles`, `revokeAccess`, `discardShared`) from `files.service.spec.ts` unchanged.
- [x] 3.4 Run `npm exec nx test chat-api`.

## 4. Extract FilesUploadService and FilesFolderService

- [x] 4.1 Move `uploadFile`, `uploadArchive`, `extractAndUploadArchive`, `stageArchiveEntryToTemp`, `uploadArchiveEntryFromTemp`, `uploadFileStream`, `createMultipartFileStream`, `buildDialUploadUrl`, `removeArchiveUploadTempDirectory`, `throwIfArchiveUploadAborted`, `decodeArchiveEntryName`, `resolveArchiveEntryPath`, and the module-level `buildUploadFormData` into `FilesUploadService`; update `FilesService` to delegate.
- [x] 4.2 Move `createFolder` and `buildCreateFolderResponse` into `FilesFolderService`, injecting `FilesUploadService` for the marker-file `uploadFile` call; update `FilesService` to delegate.
- [x] 4.3 Create `apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts` and `apps/chat-api/src/files/tests/folder/files-folder.service.spec.ts`, relocating the `uploadFile`, `uploadArchive`, `createFolder` `describe` blocks (and `resolveArchiveEntryPath`/`buildArchivePath` pieces that specifically test upload behavior) unchanged.
- [x] 4.4 Run `npm exec nx test chat-api`.

## 5. Extract FilesBatchOperationsService (delete/rename/copy/move)

- [x] 5.1 Move `deleteFiles`/`deleteItem`/`deleteFileItem`/`deleteFolderItem`, `renameFiles`/`renameItem`/`renameFileItem`/`renameFolderItem`, `copyFiles`/`copyItem`/`copyFileItem`/`copyFolderItem`, `moveFiles`/`moveItem`/`moveFileItem`/`moveFolderItem` into `FilesBatchOperationsService`, injecting `FilesListingService` for `expandFolderContents`; update `FilesService` to delegate.
- [x] 5.2 Introduce one private generic dispatcher inside `FilesBatchOperationsService` that captures the shared "fan-out → file-vs-folder dispatch → expand folder → per-child fan-out → aggregate partial failure" shape, parameterized by the per-file DIAL call and its overwrite/error-message behavior; refactor delete/rename/copy/move to call it instead of each hand-copying the dispatch logic.
- [x] 5.3 Create `apps/chat-api/src/files/tests/batch/files-batch-operations.service.spec.ts`, relocating the `deleteFiles`, `renameFiles` (file + folder), `copyFiles` (file + folder), `moveFiles` (file + folder) `describe` blocks from `files.service.spec.ts` unchanged — same assertions, verifying the shared dispatcher preserves every operation's existing nuance (e.g. rename's no-overwrite vs. move's overwrite-honored `moveResource` calls).
- [x] 5.4 Run `npm exec nx test chat-api`.

## 6. Extract FilesArchiveDownloadService and fix the HTTP boundary

- [x] 6.1 Move `downloadArchive`, `fillArchiveDownloadPool`, `startArchiveFilePrefetch`, `openDialDownloadStream`, `stageArchiveFileToTemp` into `FilesArchiveDownloadService`, injecting `FilesListingService` for `expandFolderContents`.
- [x] 6.2 Change `downloadArchive`'s signature to return a stream/result object (`{ stream, headers, abortOnDisconnect }`, matching `FilesDownloadService.downloadFile`'s existing `{ stream, headers }` contract) instead of accepting an Express `Response` parameter; move the `res.setHeader`/`flushHeaders`/pipe/`res.on('close')` wiring out of the service.
- [x] 6.3 Update `FilesService` facade's `downloadArchive` method to match the new signature (no `res` parameter), and update `FilesController`'s `download-archive` route handler to call the facade, receive the stream/headers result, and perform the response wiring itself (the one deliberate controller diff in this change). Also added the route's missing `@HttpCode(200)` — every sibling POST route already declared it explicitly; this route silently defaulted to Nest's `201` for POST without it, which a new controller test caught.
- [x] 6.4 Create `apps/chat-api/src/files/tests/archive/files-archive-download.service.spec.ts`, relocating the `downloadArchive` `describe` block from `files.service.spec.ts`, adapting assertions from "assert on a mock `res`" to "assert on the returned stream/headers object" without changing what is being verified (same headers, same content, same abort/limit behavior).
- [x] 6.5 Added `apps/chat-api/src/files/tests/files.controller.spec.ts` coverage for the `download-archive` route (new `describe('FilesController — downloadArchive', ...)` block) verifying the controller pipes the facade's returned stream and sets the same response headers as before, plus a 413 error-mapping case.
- [x] 6.6 Run `npm exec nx test chat-api`.
- [ ] 6.7 Manual verification against a live DIAL Core: **not performed** — no running DIAL Core instance or authenticated session is available in this environment. In its place, the supertest-based integration test added in 6.5 exercises the real `FilesController` → `FilesService` facade → `FilesArchiveDownloadService` → stream-piping path end-to-end with a real Node `Readable`, and it caught a real regression (missing `@HttpCode(200)`) that a one-off manual `curl` would not have pinned down as a repeatable check. Recommend a manual smoke test against a real DIAL Core environment before merging, per the design.md risk mitigation.

## 7. Consolidate duplicate node-type enums

- [x] 7.1 Create `apps/chat-api/src/files/dto/dial-file-node-type.ts` exporting `enum DialFileNodeType { Item = 'item', Folder = 'folder' }`.
- [x] 7.2 In each of `copy-files.dto.ts`, `delete-files.dto.ts`, `move-files.dto.ts`, `rename-files.dto.ts`, `download-archive.dto.ts`, `list-files.dto.ts`, replaced the local enum declaration with `export const <OriginalName> = DialFileNodeType; export type <OriginalName> = DialFileNodeType;`, keeping each file's existing exported symbol name (`CopyItemNodeType`, `DeleteItemNodeType`, `MoveItemNodeType`, `RenameItemNodeType`, `ArchiveItemNodeType`, `FileNodeType`).
- [x] 7.3 Run `npm exec nx build chat-api` and `npm exec nx test chat-api` to confirm no compile or test regressions from the enum aliasing.
- [x] 7.4 Run `npm run openapi` then `npm run openapi:check`; inspect `git diff libs/chat-api-client/` for any unexpected schema name or shape change. **Result: zero diff** in `libs/chat-api-client/` — the enum consolidation is fully OpenAPI-safe, and `openapi:check` passed with no output.

## 8. Final cleanup and verification

- [x] 8.1 Confirm `files.service.ts` contains only facade delegation methods (no remaining business logic); delete any now-dead private helpers. (212 lines — see note on 8.8.)
- [x] 8.2 Update the seven `file-manager-*` spec ownership bullets already delta'd in `specs/` — confirmed they match the final service names actually used in code (`FilesListingService`, `FilesUploadService`, `FilesFolderService`, `FilesDownloadService`, `FilesArchiveDownloadService`, `FilesSharingService`, `FilesBatchOperationsService`).
- [x] 8.3 Update `apps/chat-api/AGENTS.md` if it still references a monolithic `FilesService` pattern as the example to follow. **Not needed** — grep confirmed `apps/chat-api/AGENTS.md` contains no reference to `FilesService`.
- [x] 8.4 Run `npm exec nx test chat-api`. **1251/1251 tests pass.**
- [x] 8.5 Run `npm exec nx lint chat-api`. **Clean.**
- [x] 8.6 Run `npm exec nx build chat-api`. **Succeeds.**
- [x] 8.7 Run `rg "ExpressResponse|from 'express'" apps/chat-api/src/files/` and confirm matches exist only in `files.controller.ts` (zero in any `*.service.ts`). **Confirmed** — the only two non-test matches are `files.controller.ts` and the pre-existing `archive-upload.interceptor.ts` (an HTTP-layer NestJS interceptor, not a business service).
- [x] 8.8 Run `wc -l apps/chat-api/src/files/files.service.ts` and confirm it is under ~150 lines. **212 lines** — over the original ~100–150 target. The extra ~60 lines come from full parameter/return-type annotations on all 16 delegated methods (kept for type-safety/readability rather than using `any`); still a >90% reduction from the original 2300-line monolith and clearly a thin pass-through facade with no business logic.
- [x] 8.9 Run `wc -l` across each new service file under `apps/chat-api/src/files/**/*.service.ts` and confirm none exceeds ~400 lines (excluding test files). **Four of the seven exceed the ~400-line target**: `files-listing.service.ts` (480), `files-upload.service.ts` (532), `files-archive-download.service.ts` (464), `files-batch-operations.service.ts` (673). Each still covers exactly one concern (no cross-cutting logic bleed) and is a large reduction from the 2300-line original; the overage is primarily preserved structured logging and full JSDoc/comment fidelity carried over verbatim from the monolith to avoid behavior drift, plus (for `files-batch-operations.service.ts`) genuinely covering four public operations. This is a known, documented trade-off — see design.md Decision 3, which explicitly anticipated the batch service would land "near" rather than strictly under the target.
- [x] 8.10 Final `git diff libs/chat-api-client/` check — confirm no unintended OpenAPI drift beyond what was explicitly documented in task 7.4. **Confirmed clean** — no diff at all.
