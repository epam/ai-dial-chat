## Context

`apps/chat-api/src/files/files.service.ts` (2300 lines) is a single `@Injectable()` class with ~38 async/private methods, injected only by `FilesController` (`files.module.ts` does not even export it — nothing outside the module uses it). Method inventory by concern, from a full read of the file:

- **Listing** (`listFiles`, `listPublicFiles`, `listSharedFiles`, `listSharedByMe`, `getFileMetadata`, plus the low-level `fetchFileMetadataPage`) — read-only DIAL metadata calls.
- **Folder traversal primitive** (`expandFolderContents`, `buildArchivePath`, `getRelativeChildPath`, `toRelativePath`, the module-level `safeDecodePathForCompare`) — recursively lists a folder's files with archive-relative paths. This is called directly by **five** other concerns: `deleteFolderItem`, `renameFolderItem`, `copyFolderItem`, `moveFolderItem`, and `downloadArchive`. It is not its own concern in the original file, but it is the most cross-cutting piece of logic in the class.
- **Upload** (`uploadFile`, `uploadArchive`, `extractAndUploadArchive`, `stageArchiveEntryToTemp`, `uploadArchiveEntryFromTemp`, `uploadFileStream`, `createMultipartFileStream`, `buildDialUploadUrl`, `removeArchiveUploadTempDirectory`, `throwIfArchiveUploadAborted`, `decodeArchiveEntryName`, `resolveArchiveEntryPath`) — the largest concern (~410 lines). Existing code comments (`files.service.ts:259-265`, `:564-570`) flag `uploadFile` (SDK-based) and `uploadFileStream` (raw-fetch streaming) as two parallel, intentionally-duplicated upload code paths — this duplication is preexisting and out of scope to unify here.
- **Folder creation** (`createFolder`, `buildCreateFolderResponse`) — calls the service's own `uploadFile` to write a zero-byte marker file, a same-class cross-concern dependency that becomes a cross-service injection after the split.
- **Single-file download** (`downloadFile`) — already HTTP-agnostic: returns `{ stream, headers }`; the controller does its own `res.setHeader`/`pipeline`.
- **Archive download** (`downloadArchive`, `fillArchiveDownloadPool`, `startArchiveFilePrefetch`, `openDialDownloadStream`, `stageArchiveFileToTemp`) — the other very large concern (~330 lines). `downloadArchive` itself is a ~230-line god method: it validates item/file/byte limits, calls `expandFolderContents`, sets zip response headers, pipes `archiver`'s output **directly into an Express `Response` passed in as a parameter**, and runs a bounded-concurrency prefetch pool. `FilesController` (`:412-415`) is the only call site in the whole codebase that passes `@Res() res` into a `FilesService` method — every other route (including `downloadFile`) keeps `Response` handling local to the controller.
- **Sharing** (`shareFiles`, `revokeAccess`, `discardShared`) — three independent DIAL SDK calls, no shared internal helpers beyond `buildDialFileResourceUrl`/`mapSharePermission`.
- **Batch delete/rename/copy/move** (12 methods total, ~530 lines) — four operations that each independently reimplement the identical shape: public fan-out method → `*Item` dispatcher (file vs. folder) → `*FileItem` (single DIAL call) / `*FolderItem` (calls `expandFolderContents`, then fans out `*FileItem` over every child) → aggregate partial failures. This is a second, separate duplication pattern from the upload one above — copy-pasted four times rather than intentionally parallel.

Six DTOs (`copy-files.dto.ts`, `delete-files.dto.ts`, `move-files.dto.ts`, `rename-files.dto.ts`, `download-archive.dto.ts`, `list-files.dto.ts`) each declare a structurally identical `{ Item = 'item', Folder = 'folder' }` string enum under a different name.

`FilesService` already injects `DialClientService` (from `apps/chat-api/src/dial/`, a `@Global()` module exporting one shared SDK client instance) per the `introduce-dial-core-module` migration — that DI pattern is the one every new sub-service reuses; nothing here reintroduces the old `AppService` inheritance pattern.

Constraints:
- No REST contract changes: routes, DTO shapes, status codes, and (ideally) OpenAPI schema names are unchanged.
- `FilesController`'s constructor and route bodies stay as-is except the `download-archive` route, which must stop passing `@Res()` into the service.
- Every existing `files.service.spec.ts` test scenario (22 top-level `describe` blocks, already grouped one-per-public-method) must keep passing with unchanged assertions, just relocated.
- Seven live `file-manager-*` specs assert or imply "`FilesService` owns X" and must be updated to name the new owning service, without changing any requirement or scenario.

## Goals / Non-Goals

**Goals:**
- Decompose the 2300-line god service into seven single-concern services, none exceeding ~400 lines (test files excluded), plus a thin `FilesService` facade (~100–150 lines).
- Give the shared "expand a folder into its file list" logic (`expandFolderContents` and friends) one home (`FilesListingService`) instead of being a floating dependency of five different concerns.
- Remove Express `Response` from the service layer entirely — `FilesArchiveDownloadService` returns a stream/result object the same way `FilesDownloadService` already does, and `FilesController` becomes the only place touching `Response`.
- Collapse the four hand-copied batch-operation dispatch shapes (delete/rename/copy/move) into one shared internal helper inside `FilesBatchOperationsService`, provided existing tests prove behavior equivalence at each step.
- Consolidate the six duplicate `ItemNodeType`-shaped enums into one runtime `DialFileNodeType`, without changing any generated OpenAPI schema name.
- Keep every existing test green after each migration slice (verified via `nx test chat-api`).

**Non-Goals:**
- Any REST endpoint, DTO shape, status code, or OpenAPI/generated-client behavior change. If enum consolidation is later found to force an OpenAPI schema rename, that becomes an explicit, separately-flagged decision — not a silent side effect of this change.
- Unifying `uploadFile`/`uploadFileStream` into one code path — that duplication is pre-existing, intentional per the current code comments, and out of scope.
- Splitting `useDialFileManager` on the frontend — tracked separately as `split-use-dial-file-manager`.
- Splitting `ConversationService` or any other god service.
- New integration/e2e tests — unit test parity (relocated, not rewritten) is sufficient.
- Retiring the `FilesService` facade — `FilesController` keeps injecting `FilesService`; only the facade's internals change.

## Decisions

**1. `FilesListingService` owns the shared folder-traversal primitive, not a separate `FilesTraversalService`.**
`expandFolderContents`/`buildArchivePath`/`getRelativeChildPath`/`toRelativePath` are fundamentally paginated-listing operations over DIAL metadata (`getFileMetadata`), and `FilesListingService` already owns `getFileMetadata`/`listFiles`. `FilesBatchOperationsService` and `FilesArchiveDownloadService` inject `FilesListingService` to call `expandFolderContents`. Alternative considered: a ninth, dedicated `FilesTraversalService` — rejected as an unnecessary extra seam; the traversal logic has no state or config independent of listing, and adding a service purely to host one shared method increases indirection for no isolation benefit.

**2. `FilesArchiveDownloadService.downloadArchive` returns a stream/result object; `FilesController` does the piping.**
This mirrors the existing, working `FilesDownloadService.downloadFile` → `{ stream, headers }` → controller-side `pipeline` pattern already used by the `GET /download` route, so the fix is "make archive download consistent with single download," not "invent a new pattern." Alternative considered: keep passing `Response` into the service but wrap it in an interface — rejected because it still leaks an Express-shaped contract into the service layer instead of removing it, which is the actual requirement.

**3. Batch operations stay as one `FilesBatchOperationsService`, with the delete/rename/copy/move duplication collapsed into one private generic dispatcher.**
All four operations share the exact same shape (fan-out → file-vs-folder dispatch → expand folder → per-child fan-out → aggregate). A single private helper — parameterized by the per-file DIAL call (`deleteFile`/`moveResource`/`copyResource`) and its error-message builder — removes the four hand-copied dispatchers and keeps the resulting file near the ~400-line target despite covering four public operations. Alternative considered: four separate services (`FilesDeleteService`, `FilesRenameService`, `FilesCopyService`, `FilesMoveService`) — rejected because it would multiply the number of services without adding isolation (they already share 100% of their control flow and only differ in which DIAL SDK call and error mapper they use), and would make the generic-dispatcher refactor harder to justify as one cohesive unit.

**4. `FilesFolderService` injects `FilesUploadService` for `createFolder`'s marker-file write.**
This preserves the existing same-process call (`createFolder` → `uploadFile`) as a cross-service injection rather than duplicating upload logic into the folder service. Alternative considered: duplicate a minimal marker-upload call inside `FilesFolderService` — rejected, reintroduces the exact kind of duplication this change is meant to remove.

**5. `FilesService` remains as a facade; `FilesController` is untouched except the `download-archive` route body.**
The proposal's `FilesController` constructor and every other route body already only call `filesService.<method>(...)`; keeping the facade means zero controller diff for 15 of 16 routes, and the facade centralizes the one deliberate exception. Alternative considered: have `FilesController` inject all seven sub-services directly and delete the facade — rejected as a larger, riskier diff to the one file guaranteed to be thin already (`AGENTS.md` "controllers are thin" rule), for no behavioral benefit; it also would have required rewriting all 16 route handler bodies instead of one.

**6. Enum consolidation keeps six exported names, all aliasing one runtime enum.**
`files/dto/dial-file-node-type.ts` exports `enum DialFileNodeType { Item = 'item', Folder = 'folder' }`. Each existing DTO file replaces its own enum declaration with `export const CopyItemNodeType = DialFileNodeType; export type CopyItemNodeType = DialFileNodeType;` (same pattern for the other five), so `@ApiProperty({ enum: CopyItemNodeType })` keeps referencing the same exported symbol name at each call site. This is verified, not assumed, via `npm run openapi:check` and `git diff libs/chat-api-client/` after the change — if Swagger's generated schema name changes anyway (e.g., because it were keyed by declaration site rather than symbol name), the task list calls for stopping and documenting the specific diff rather than silently accepting it.

**7. Migration order: gateway-independent low-risk concerns first, HTTP-boundary fix and highest-risk concern (archive download) last.**
Order: `FilesListingService` → `FilesDownloadService` → `FilesSharingService` → `FilesFolderService` (needs `FilesUploadService`, so `FilesUploadService` lands just before it) → `FilesBatchOperationsService` (needs `FilesListingService`, already landed) → `FilesArchiveDownloadService` (needs `FilesListingService`, is the highest-risk HTTP-boundary change, and benefits from every simpler concern already being proven out) → facade cleanup. This matches the "land the riskiest piece once the pattern is proven" logic used in `introduce-dial-core-module`'s own migration plan.

## Risks / Trade-offs

- **[Risk]** Moving `downloadArchive` off direct `Response` writes could subtly change streaming/backpressure behavior (the current method calls `res.flushHeaders()` and listens for `res.on('close')` mid-stream for abort handling). → **Mitigation**: land this slice last, after every other service is extracted and the team has a proven pattern from `FilesDownloadService`; keep the existing integration-style tests in `downloadArchive`'s spec block un-relaxed (same headers, same abort behavior, same partial-content handling) and add a manual verification step (`curl` a multi-file archive download) before merging that slice.
- **[Risk]** Collapsing four batch operations into one generic dispatcher could accidentally lose an operation-specific nuance (e.g., `renameFileItem` uses `moveResource` with no overwrite, while `moveFileItem` uses `moveResource` with overwrite honored). → **Mitigation**: write the generic dispatcher to take the per-file operation and overwrite-behavior as explicit parameters (not inferred), and keep all four operations' existing per-`describe`-block tests passing unchanged — any lost nuance shows up immediately as a test failure, not a silent behavior change.
- **[Risk]** Enum consolidation could unexpectedly rename a generated OpenAPI schema even when each exported symbol name is preserved (NestJS Swagger sometimes keys enum schema names by import path or declaration order). → **Mitigation**: run `npm run openapi:check` immediately after the enum-consolidation slice, before any other change lands on top of it, so a diff is easy to isolate and revert if unacceptable.
- **[Risk]** `FilesModule` currently has no `exports: []` array — new sub-services must be registered as providers but do not need exporting unless a future consumer outside `FilesModule` needs them; forgetting this is a build-time NestJS DI error, not a silent bug. → **Mitigation**: `nx build chat-api` after every slice that adds a new provider.
- **[Trade-off]** Keeping `FilesService` as a facade means one extra indirection layer (controller → facade → sub-service) that a full "controller injects sub-services directly" design would avoid. Accepted because it minimizes the controller diff and keeps the single deliberate `download-archive` signature change isolated to one file (the facade) instead of leaking into the controller during migration.

## Migration Plan

1. Add all seven new services (empty/skeleton, each injecting `DialClientService`) plus the `DialFileNodeType` enum, registered in `FilesModule.providers`, with no behavior moved yet and `FilesService` untouched. `nx build chat-api` to confirm wiring.
2. Extract `FilesListingService` (including the folder-traversal primitive): move methods, move+adapt their `describe` blocks into a new spec file, make `FilesService`'s corresponding methods thin delegations. `nx test chat-api`.
3. Extract `FilesDownloadService`, `FilesSharingService` (no shared dependencies on other new services — safe to land in either order or together). `nx test chat-api` after each.
4. Extract `FilesUploadService`, then `FilesFolderService` (which injects `FilesUploadService`). `nx test chat-api` after each.
5. Extract `FilesBatchOperationsService` (injects `FilesListingService`), introducing the shared dispatcher and collapsing the four hand-copied implementations. `nx test chat-api`.
6. Extract `FilesArchiveDownloadService` (injects `FilesListingService`), change its public method to return a stream/result object, and update `FilesController`'s `download-archive` route body to pipe it — the one deliberate controller diff. `nx test chat-api`; manual archive-download smoke check.
7. Consolidate the six enums into `DialFileNodeType`; run `npm run openapi` + `npm run openapi:check`; inspect `git diff libs/chat-api-client/` for any unexpected drift.
8. Final cleanup: confirm `files.service.ts` body is facade-only (~100–150 lines), delete now-unused private helpers from the monolith, update the seven `file-manager-*` spec ownership bullets and `apps/chat-api/AGENTS.md` if it still references a monolithic `FilesService` pattern, run the full verification checklist from `tasks.md`.

No feature flag or staged rollout needed — this is an internal refactor behind normal `nx test`/`lint`/`build` CI gates; rollback at any slice is a plain revert since no REST contract or data shape changes.

## Open Questions

None outstanding. The one genuine ambiguity — whether enum consolidation is guaranteed OpenAPI-schema-safe — is resolved procedurally (Decision 6 + the dedicated verification slice) rather than left open, matching how `introduce-dial-core-module` resolved its one ambiguity around `DeploymentsService`/`ToolsetsService` caching.
