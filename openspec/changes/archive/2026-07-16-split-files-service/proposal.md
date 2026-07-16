## Why

`apps/chat-api/src/files/files.service.ts` is a 2300-line god service with ~38 async methods mixing DIAL SDK/HTTP calls, Express response streaming, zip archive build/extract (`archiver` + `yauzl`), temp-directory lifecycle, listing, upload, folder creation, batch copy/move/rename/delete, and sharing. Its spec file (`files/tests/files.service.spec.ts`, 3142 lines) is a symptom of untestable structure, not insufficient coverage. This blocks safe feature work on the file manager — the fastest-growing area of the backend — and contradicts the thin-controller / single-responsibility guidance in `apps/chat-api/AGENTS.md` and the ownership bullets in seven live `file-manager-*` specs that all say "`FilesService` owns X logic."

`introduce-dial-core-module` (archived 2026-07-08) explicitly deferred this: its design.md lists "Splitting god services (`ConversationService`, `FilesService`)" as an out-of-scope Non-Goal, "tracked separately (Phase 2.2+)." This change is that deferred work, scoped to the files domain only, and reuses the `DialClientService` injection pattern that change established.

## What Changes

- Split `FilesService` into seven focused injectable services under `apps/chat-api/src/files/`, each with a single concern, all constructor-injecting `DialClientService` (never re-extending a base class):
  - `FilesListingService` — read-only listing/metadata plus the shared recursive folder-expansion primitive (`expandFolderContents`, `buildArchivePath`, `getRelativeChildPath`, `toRelativePath`) that delete/rename/copy/move/archive-download all currently call directly on the monolith.
  - `FilesUploadService` — single-file and archive upload, temp-file staging, multipart streaming.
  - `FilesFolderService` — folder creation (depends on `FilesUploadService` for the marker-file upload, mirroring today's in-class call).
  - `FilesDownloadService` — single-file download (already HTTP-agnostic: returns `{ stream, headers }`).
  - `FilesArchiveDownloadService` — zip download; refactored to return a stream/result object like `FilesDownloadService` instead of writing directly to an injected Express `Response`.
  - `FilesSharingService` — share/revoke/discard.
  - `FilesBatchOperationsService` — delete/rename/copy/move, de-duplicating the four operations' identical "dispatch file-vs-folder → expand folder → per-child fan-out → aggregate partial failure" shape into one internal helper instead of four hand-copied implementations.
- Keep `FilesService` as a thin facade (target ~100–150 lines) that `FilesController` continues to inject unchanged, delegating each public method to the owning sub-service — the controller's constructor and route bodies do not change shape.
- **HTTP boundary fix**: `downloadArchive` currently takes an Express `Response` and writes to it directly (`files.controller.ts:412-415` passes `@Res() res` straight into the service — the only route that does this). The new `FilesArchiveDownloadService` returns a stream + header metadata; `FilesController` becomes the only place that touches `Response` for this route, matching the pattern the existing `downloadFile`/`GET /download` route already uses.
- Consolidate six structurally-identical `{ Item = 'item', Folder = 'folder' }` enums (`CopyItemNodeType`, `DeleteItemNodeType`, `MoveItemNodeType`, `RenameItemNodeType`, `ArchiveItemNodeType`, `FileNodeType`) into one shared `DialFileNodeType` in `files/dto/dial-file-node-type.ts`, keeping each DTO's existing exported enum name as an alias so Swagger schema names (and therefore `@epam/chat-api-client`) do not change.
- Split `files/tests/files.service.spec.ts` into one spec file per new service, transplanting the existing `describe` blocks (already grouped one-per-public-method) with no assertion changes.
- Update the seven `file-manager-*` specs whose requirements currently name `FilesService` as sole owner, to name the specific sub-service instead — implementation-detail wording only, no scenario or requirement behavior changes.
- **BREAKING (internal only)**: any test mocking `FilesService` directly for methods that move to a sub-service must be updated to mock the new service. No REST/DTO/OpenAPI contract changes are intended; if enum consolidation is later found to rename a generated OpenAPI schema, that will be called out explicitly and verified via `git diff libs/chat-api-client/`.

## Capabilities

### New Capabilities

- `files-service-decomposition`: the internal ownership map — which sub-service under `apps/chat-api/src/files/` owns which file-manager backend behavior — plus the equivalence contract that every existing `file-manager-*` spec scenario continues to hold unchanged after the split.

### Modified Capabilities

- `file-manager-sharing`: ownership bullet changes from "`FilesService` owns share/revoke/discard" to "`FilesSharingService` owns share/revoke/discard; `FilesController` delegates through the `FilesService` facade" — no scenario change.
- `file-manager-upload-archive`: ownership bullet changes to name `FilesUploadService` — no scenario change.
- `file-manager-copy-move`: ownership bullet changes to name `FilesBatchOperationsService` — no scenario change.
- `file-manager-delete-api`: ownership bullet changes to name `FilesBatchOperationsService` — no scenario change.
- `file-manager-download`: ownership bullet changes to name `FilesArchiveDownloadService` (archive) and `FilesDownloadService` (single file); the documented `FilesService.downloadArchive(items, at, res)` signature changes to a `Response`-free signature — no scenario or HTTP-contract change.
- `file-manager-rename-api`: ownership bullet changes to name `FilesBatchOperationsService` — no scenario change.
- `file-manager-folder-creation`: ownership bullet changes to name `FilesFolderService` (and notes its dependency on `FilesUploadService`) — no scenario change.

## Impact

- **Affected code**: `apps/chat-api/src/files/files.service.ts` (shrinks to a facade), seven new service files + their spec files under new subfolders (`listing/`, `upload/`, `folder/`, `download/`, `archive/`, `sharing/`, `batch/`), `files.module.ts` (new providers), `files.controller.ts` (only the `download-archive` route body changes, to pipe a returned stream instead of passing `res` into the service), six DTO files (enum re-export), new `files/dto/dial-file-node-type.ts`.
- **Affected APIs**: none by default — same routes, DTOs, status codes; `npm run openapi`/`openapi:check` run only to confirm no drift, not to intentionally change the contract.
- **Affected specs**: seven `file-manager-*` specs (implementation-detail bullets only) plus one new `files-service-decomposition` capability.
- **Dependencies**: no new npm packages; continues to use `@epam/ai-dial-typescript-sdk` via `DialClientService`, `archiver`, `yauzl`, `common/dial/dial-error.mapper.ts`.
- **Systems**: none outside `apps/chat-api` — no frontend change, no `chat-api-client` regeneration expected.
