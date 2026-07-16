# Spec: files-service-decomposition

### Requirement: Files domain service ownership map

The backend SHALL implement the files feature's business logic in `apps/chat-api/src/files/` as seven single-concern injectable services, each constructor-injecting `DialClientService` (`apps/chat-api/src/dial/dial-client.service.ts`) directly — never extending a base class:

- `FilesListingService` (`listing/files-listing.service.ts`) — read-only listing/metadata (`listFiles`, `listPublicFiles`, `listSharedFiles`, `listSharedByMe`, `getFileMetadata`) plus the shared recursive folder-traversal primitive (`expandFolderContents`, `buildArchivePath`, `getRelativeChildPath`, `toRelativePath`) used by every batch and archive-download operation below.
- `FilesUploadService` (`upload/files-upload.service.ts`) — single-file and archive upload, temp-file staging, multipart streaming.
- `FilesFolderService` (`folder/files-folder.service.ts`) — folder creation; injects `FilesUploadService` for the marker-file write.
- `FilesDownloadService` (`download/files-download.service.ts`) — single-file download; returns `{ stream, headers }`.
- `FilesArchiveDownloadService` (`archive/files-archive-download.service.ts`) — zip download; injects `FilesListingService` for folder expansion; returns a stream/result object rather than writing to an Express `Response` directly.
- `FilesSharingService` (`sharing/files-sharing.service.ts`) — share/revoke/discard.
- `FilesBatchOperationsService` (`batch/files-batch-operations.service.ts`) — delete/rename/copy/move; injects `FilesListingService` for `expandFolderContents`; the four operations share one internal dispatch helper rather than four hand-copied implementations.

`FilesService` (`files.service.ts`) SHALL remain as a thin facade that `FilesController` continues to inject unchanged, delegating each of its public methods to the owning service above. No file under `apps/chat-api/src/files/` other than test files SHALL exceed approximately 400 lines; `files.service.ts` SHALL be approximately 100–150 lines.

#### Scenario: Controller and facade wiring is unaffected by the split

- **WHEN** `FilesController` is constructed
- **THEN** it injects only `FilesService`, exactly as before the split, and every route handler body other than `download-archive` is unchanged

#### Scenario: Each sub-service is independently unit-testable

- **WHEN** a test constructs `FilesBatchOperationsService` directly (via `@nestjs/testing`)
- **THEN** it only needs to provide mocks for `DialClientService` and `FilesListingService` — no other sub-service's dependencies are required

### Requirement: No REST contract change from the split

Splitting `FilesService` into sub-services SHALL NOT change any route path, HTTP method, request/response DTO shape, status code, or (barring an explicitly documented and verified exception) generated OpenAPI schema name for any `/api/v1/files/*` endpoint.

#### Scenario: Every existing file-manager spec scenario still holds

- **WHEN** any scenario documented in `file-manager-sharing`, `file-manager-upload-archive`, `file-manager-copy-move`, `file-manager-delete-api`, `file-manager-download`, `file-manager-rename-api`, or `file-manager-folder-creation` is exercised against the post-split backend
- **THEN** the observed HTTP request/response behavior is identical to before the split; only the internal service and file that implements it has changed

#### Scenario: OpenAPI drift is verified, not assumed

- **WHEN** the six duplicate `*ItemNodeType` enums are consolidated into `DialFileNodeType`
- **THEN** `npm run openapi:check` passes with no unexpected diff in `libs/chat-api-client/`, or the diff is explicitly documented and accepted before merge

### Requirement: HTTP-agnostic archive download contract

`FilesArchiveDownloadService`'s public method for building a ZIP archive SHALL return a stream and header metadata (mirroring the existing `FilesDownloadService.downloadFile` → `{ stream, headers }` contract) rather than accepting an Express `Response` object. `FilesController` SHALL be the only place in the files domain that constructs an Express `Response` for a download route.

#### Scenario: Archive download route pipes a returned stream

- **WHEN** `POST /api/v1/files/download-archive` is handled
- **THEN** `FilesController` calls the facade, receives a stream/headers result, and performs `res.setHeader`/piping itself — no `FilesService` or sub-service method receives `@Res()` as a parameter

#### Scenario: No Express types in the service layer

- **WHEN** `apps/chat-api/src/files/**/*.service.ts` (excluding the controller) is searched for `express`/`Response`/`Request` imports
- **THEN** no matches are found
