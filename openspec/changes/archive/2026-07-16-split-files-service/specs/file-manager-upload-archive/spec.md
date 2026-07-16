## MODIFIED Requirements

### Requirement: POST /api/v1/files/upload-archive endpoint

The BFF SHALL expose `POST /api/v1/files/upload-archive` (multipart/form-data) that accepts a ZIP archive and a destination, streams-extracts its entries via `yauzl`, and uploads each valid entry to DIAL Core via `FilesUploadService.uploadFile(bucket, path, file, token, 'create-only')`, returning a per-entry result array.

**State ownership**: `FilesUploadService` (`apps/chat-api/src/files/upload/files-upload.service.ts`) owns all extraction/upload logic, including single-file upload (`uploadFile`, `uploadFileStream`) and archive extraction (`extractAndUploadArchive` and its temp-file staging helpers); `FilesController` delegates through the `FilesService` facade (thin-controller pattern).

**Authorization**: session cookie → `req.user.at`, identical to `POST /api/v1/files`. Core enforces WRITE permission on the destination per entry, surfaced as a per-entry `"Forbidden"` result.

**Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })` — matching `/download-archive`'s stricter limit.

#### Scenario: Valid ZIP with two files uploads both entries

- **WHEN** `POST /api/v1/files/upload-archive` is called with a ZIP containing two files and no conflicts
- **THEN** the response contains 2 results, both `success: true`

#### Scenario: Conflicting entry is reported as a failed result, extraction continues

- **WHEN** one entry's destination path already exists and DIAL Core returns 412 for that entry's `create-only` upload
- **THEN** that entry's result is `{ success: false, error: "Conflict" }` and the remaining entries are still processed

### Requirement: Upload-archive observability

`FilesUploadService` SHALL emit structured log lines at the start and end of `uploadArchive`, including `entryCount`, `successCount`, and `failedCount`. Log lines SHALL NOT include archive entry file names, file contents, or the destination path beyond what is already logged for ordinary uploads.

#### Scenario: Upload-archive call logged on start and completion

- **WHEN** `uploadArchive` is called with an archive containing N entries
- **THEN** a `log` line records `entryCount=N` at start, and another records `successCount`/`failedCount` at completion
