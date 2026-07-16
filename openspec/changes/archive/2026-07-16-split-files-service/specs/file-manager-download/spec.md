## MODIFIED Requirements

### Requirement: Archive generation backend implementation

Archive downloads SHALL be built with the `archiver` npm package, owned by `FilesArchiveDownloadService` (`apps/chat-api/src/files/archive/files-archive-download.service.ts`), which injects `FilesListingService` for folder expansion instead of implementing its own traversal. Unlike the original monolithic `FilesService.downloadArchive(items, at, res)`, the service method SHALL NOT accept an Express `Response`; it SHALL return a stream and header metadata (the same `{ stream, headers }`-shaped contract already used by `FilesDownloadService.downloadFile`). `FilesController` is the only place that constructs the Express `Response` for this route — it calls the facade, receives the stream/headers result, sets response headers, and pipes the stream itself.

1. **Pre-validate** `items` array (checked by DTO, but the service applies limits).
2. **Expand folders**: for each `nodeType === 'folder'` item, call `FilesListingService.expandFolderContents(bucket, path, at, { recursive: true })`, which paginates via `nextToken` until exhausted. Include all file items (including `.dial_folder` markers); skip folder nodes only.
3. **Expand files**: add `nodeType === 'item'` items directly to the flat list.
4. **Deduplicate** by `{bucket}:{path}`: when a folder and one of its children are both selected, keep one entry.
5. **Validate limits**: `expandedFiles.length > ARCHIVE_MAX_FILES` → throw `413 PayloadTooLargeException` (before headers); total content length over `ARCHIVE_MAX_UNCOMPRESSED_BYTES` → throw `413`.
6. **Build the archive**: create an `archiver` instance (`format: 'zip'`), append each expanded file's DIAL Core download stream, and return the resulting stream plus the computed headers (`Content-Type`, `Content-Disposition`, `Cache-Control`) to the caller — `FilesController` performs the actual `res.setHeader`/pipe/abort-on-disconnect wiring.

#### Scenario: Archive download route pipes a returned stream, not a passed-in Response

- **WHEN** `POST /api/v1/files/download-archive` is handled
- **THEN** `FilesController` calls the `FilesService` facade, receives `{ stream, headers }` from `FilesArchiveDownloadService`, and performs `res.setHeader`/piping itself
- **AND** no `FilesArchiveDownloadService` method receives `@Res()` as a parameter

#### Scenario: Overlapping folder/file selection deduplication

- **GIVEN** the user selects `reports/` (folder) AND `reports/2026/q1.pdf` (a child of that folder)
- **WHEN** `POST /api/v1/files/download-archive` is processed
- **THEN** the expanded flat list contains `reports/2026/q1.pdf` exactly once
- **AND** the ZIP contains the file at `reports/2026/q1.pdf` without duplication

#### Scenario: Archive max files limit exceeded

- **GIVEN** `ARCHIVE_MAX_FILES = 1000` and the selection expands to 1500 files
- **WHEN** `POST /api/v1/files/download-archive` processes the expansion
- **THEN** the BFF returns `413 Payload Too Large` before committing response headers
- **AND** no partial ZIP is streamed

### Requirement: Recursive folder expansion and pagination

`FilesListingService.expandFolderContents(bucket, path, at, options)` (relocated from the original monolithic `FilesService`, and reused by `FilesBatchOperationsService` for delete/rename/copy/move as well as by `FilesArchiveDownloadService`) SHALL:

1. Call `client.getFileMetadata(bucket, path, { recursive: true, token: options.token })`.
2. Recursively fetch subsequent pages while `nextToken` is present in the response.
3. Include all file items (including `.dial_folder` markers); skip folder nodes only.
4. Return a flat `ExpandedFile[]`.

#### Scenario: Paginated recursive listing

- **GIVEN** folder `large-folder/` contains 1500 files (exceeds the default single-page limit)
- **WHEN** the archive endpoint expands `large-folder/`
- **THEN** `FilesListingService.expandFolderContents` calls `getFileMetadata` with `recursive: true`, follows `nextToken` until exhausted
- **AND** all 1500 files are included in the expansion (subject to `ARCHIVE_MAX_FILES` limit)

### Requirement: ZIP-slip prevention

Applied in `FilesListingService.buildArchivePath(baseName, relativePath)` (relocated from the original monolithic `FilesService`):

- Reject any path segment equal to `..`.
- Reject absolute paths (starting with `/`).
- Reject backslash-containing paths.
- Assert the fully resolved archive path starts with the expected base path.
- If any check fails: `logger.error` + `InternalServerErrorException` (before headers) or skip entry (after headers, log only).

#### Scenario: Client disconnect during streaming

- **GIVEN** the archive stream returned by `FilesArchiveDownloadService` has started (headers committed by `FilesController`) and the client disconnects mid-download
- **WHEN** `req.on('close')` fires on the NestJS controller
- **THEN** the abort handler calls `archive.abort()` and destroys the response stream
- **AND** all pending SDK `downloadFile` calls are aborted via `AbortController`
- **AND** no error is thrown to the client (connection already closed)
