## MODIFIED Requirements

### Requirement: Files domain service ownership map

The backend SHALL implement the files feature's business logic in `apps/chat-api/src/files/` as seven single-concern injectable services, each constructor-injecting `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) and `ConfigService` directly — never extending a base class:

- `FilesListingService` (`listing/files-listing.service.ts`) — read-only listing/metadata (`listFiles`, `listPublicFiles`, `listSharedFiles`, `listSharedByMe`, `getFileMetadata`) plus the shared recursive folder-traversal primitive (`expandFolderContents`, `buildArchivePath`, and the private `getRelativeChildPath`) used by every batch and archive-download operation below. The bucket-relative path helper `toRelativePath` lives in `dial-resource-path.util.ts`, alongside `encodeDialFilePath`, and is imported by the listing, download, and archive services.
- `FilesUploadService` (`upload/files-upload.service.ts`) — single-file and archive upload, temp-file staging, multipart streaming.
- `FilesFolderService` (`folder/files-folder.service.ts`) — folder creation; injects `FilesUploadService` for the marker-file write.
- `FilesDownloadService` (`download/files-download.service.ts`) — single-file download; returns `{ stream, headers }`.
- `FilesArchiveDownloadService` (`archive/files-archive-download.service.ts`) — zip download; injects `FilesListingService` for folder expansion; returns an `ArchiveDownloadResult` (`{ stream, headers, abortOnDisconnect }`) rather than writing to an Express `Response` directly.
- `FilesSharingService` (`sharing/files-sharing.service.ts`) — share/revoke/discard.
- `FilesBatchOperationsService` (`batch/files-batch-operations.service.ts`) — delete/rename/copy/move; injects `FilesListingService` for `expandFolderContents`; the four operations share one private folder fan-out helper (`runFolderFanOut`) rather than four hand-copied implementations, and rename, copy and move additionally share one private transfer pipeline (`transferFiles` → `transferItem` → `transferFileItem` / `transferFolderItem`) parameterized by a `FileTransferKind` (`apps/chat-api/src/files/types/file-transfer-kind.enum.ts`) whose per-operation differences — the DIAL Core SDK operation (`moveResource` or `copyResource`), the `handleDialSdkError` operation tag, the per-item failure and partial-failure strings, the log names, whether `overwrite` is honored (rename always sends `false`), and whether a destination inside the source is rejected (move only) — live in one `FILE_TRANSFER_STRATEGIES` record in `batch/file-transfer-strategy.ts`, not in per-operation method copies.

`FilesService` (`files.service.ts`) SHALL remain as a thin facade that `FilesController` continues to inject unchanged, delegating each of its public methods to the owning service above. No file under `apps/chat-api/src/files/` other than test files SHALL exceed approximately 400 lines; `files.service.ts` SHALL be approximately 100–150 lines.

#### Scenario: Controller and facade wiring is unaffected by the split

- **WHEN** `FilesController` is constructed
- **THEN** its only files-domain dependency is `FilesService` (alongside `ConfigService`, which it reads for `ALLOWED_IFRAME_ORIGINS`), and every route handler body other than `download-archive` is unchanged

#### Scenario: Each sub-service is independently unit-testable

- **WHEN** a test constructs `FilesBatchOperationsService` directly (via `@nestjs/testing`)
- **THEN** it only needs to provide mocks for `DialClientService`, `ConfigService`, and `FilesListingService` — no other sub-service's dependencies are required

#### Scenario: Rename, copy and move run through one transfer pipeline

- **WHEN** `files-batch-operations.service.ts` is inspected
- **THEN** it calls `copyResource`/`moveResource` in exactly one place, declares no per-operation `*FileItem`/`*FolderItem` method for rename, copy or move, and `renameFiles`, `copyFiles` and `moveFiles` delegate to the shared pipeline with their `FileTransferKind`

#### Scenario: Per-operation behavior is preserved by the strategy record

- **WHEN** the existing `files-batch-operations.service.spec.ts` suite runs against the deduplicated service
- **THEN** every test passes unchanged — including rename never overwriting, the move-only "Cannot move a folder into itself or its subfolders" rejection, the 400-conflict probe, and the "Partial rename" / "Partial copy" / "Partial move" strings
