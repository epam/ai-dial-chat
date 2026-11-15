## MODIFIED Requirements

### Requirement: POST /api/v1/files/upload-archive endpoint

The BFF SHALL expose `POST /api/v1/files/upload-archive` (multipart/form-data) that accepts a ZIP archive and a destination, streams-extracts its entries via `yauzl`, and uploads each valid entry to DIAL Core using the create-only contract. If DIAL Core reports a name collision for an entry, the service SHALL retry that same entry with a deduplicated sibling name (`name (1).ext`, `name (2).ext`, etc.) until the upload succeeds or the retry limit is reached. The endpoint returns a per-entry result array with the final uploaded path for successful entries.

The file-count limit SHALL be enforced before extraction/upload starts. `FilesArchiveUploadService` SHALL enumerate ZIP central-directory metadata and count non-directory entries before opening any entry read stream, staging entry bytes, or calling DIAL Core upload. Before that count, if the archive's total entry count (directories included) exceeds `ARCHIVE_UPLOAD_MAX_FILES * 10`, the endpoint SHALL fail with `422 Unprocessable Entity` and the message `Archive contains too many entries` (directory-entry amplification guard). If the non-directory count exceeds `ARCHIVE_UPLOAD_MAX_FILES`, the endpoint SHALL fail with `422 Unprocessable Entity`, return the message `Archive contains more than {maxFiles} files`, and attempt zero entry uploads. This all-or-nothing rule applies only to the file-count limit; the uncompressed-size limit remains a mid-extraction guard and may leave entries uploaded before the abort.

**State ownership**: `FilesArchiveUploadService` (`apps/chat-api/src/files/upload/files-archive-upload.service.ts`) owns archive extraction (`uploadArchive`, `extractAndUploadArchive` and its temp-file staging and conflict-renaming helpers), with its dependency-free path and name helpers in `apps/chat-api/src/files/upload/archive-upload.ts`; every entry is uploaded through the single-file transport `FilesUploadService.uploadFileStream` (`apps/chat-api/src/files/upload/files-upload.service.ts`), which also serves `uploadFile`; `FilesController` delegates through the `FilesService` facade (thin-controller pattern).

**Authorization**: session cookie → `req.user.at`, identical to `POST /api/v1/files`. Core enforces WRITE permission on the destination per entry, surfaced as a per-entry `"Forbidden"` result (matching how `/copy`/`/move` surface per-item Core-side authorization failures).

**Caching**: no NestJS cache read/write. Frontend-side folder-listing cache for the parent destination folder is invalidated by the hook on completion so the archive-named child folder appears in the refreshed listing.

#### Request

Multipart fields: `file` (the ZIP, binary), `bucket` (string), `destinationPath` (string, relative path within bucket — the final folder entries are extracted into). The frontend SHALL pass an archive-named child folder as `destinationPath`; for example, uploading `archive.zip` from `reports/` calls the endpoint with `destinationPath: "reports/archive/"`, using the ui-kit's prepared archive name without the `.zip` extension.

**`UploadArchiveDto`** (`apps/chat-api/src/files/dto/upload-archive.dto.ts`, describes the non-file fields for Swagger/validation):

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(BUCKET_NAME_PATTERN) @MaxLength(256)` | DIAL Core bucket |
| `destinationPath` | `string` | `@IsString @IsValidFilePath() @MaxLength(1024)` (no `@IsNotEmpty`) | Destination folder, relative to bucket; an empty string uploads to the bucket root |

#### Response DTO

**`UploadArchiveEntryResultDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Final destination path of the extracted entry (relative to bucket); for conflict-resolved entries this is the deduplicated path |
| `success` | `boolean` | `true` when the entry was extracted and uploaded successfully |
| `error` | `string?` | Human-readable error reason when `success` is `false` |

**`UploadArchiveResponseDto`**: `{ results: UploadArchiveEntryResultDto[] }`

#### Controller signature

```typescript
@Post('upload-archive')
@HttpCode(200)
@UseInterceptors(ArchiveUploadInterceptor) // stages the multipart `file` on disk
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    required: ['file', 'bucket', 'destinationPath'],
    properties: {
      file: { type: 'string', format: 'binary' },
      bucket: { type: 'string' },
      destinationPath: { type: 'string' },
    },
  },
})
@ApiOperation({ summary: 'Upload a ZIP archive and extract its contents to a destination folder' })
@ApiResponse({ status: 200, type: UploadArchiveResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request, non-ZIP file, or empty archive' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 413, description: 'Archive exceeds ARCHIVE_UPLOAD_MAX_BYTES' })
@ApiResponse({ status: 422, description: 'Archive exceeds ARCHIVE_UPLOAD_MAX_FILES or ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable, timed out, or ARCHIVE_UPLOAD_TIMEOUT_MS exceeded' })
uploadArchive(
  @UploadedFile() file: Express.Multer.File | undefined,
  @Body() body: UploadArchiveDto,
  @Req() req: Request,
): Promise<UploadArchiveResponseDto> // throws BadRequestException('file is required') when file is missing
```

`FilesArchiveUploadService.uploadArchive` reads the staged archive by its `path` (not an in-memory buffer) and also rejects an empty `path` with `400 file is required`.

#### Generated-client impact

- **operationId**: derived from handler name `uploadArchive` → `filesApi.uploadArchive({ file, bucket, destinationPath })`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `uploadArchive(file: File, bucket: string, destinationPath: string): Promise<UploadArchiveResponseDto>` using the normal (non-`Raw`) generated method.

**Example response**:
```json
{
  "results": [
    { "path": "reports/archive/q1.pdf", "success": true },
    { "path": "reports/archive/q2 (1).pdf", "success": true }
  ]
}
```

#### Scenario: Valid ZIP with two files uploads both entries

- **WHEN** `POST /api/v1/files/upload-archive` is called with a ZIP containing two files and no conflicts
- **THEN** the response contains 2 results, both `success: true`

#### Scenario: Empty ZIP returns an empty results array

- **WHEN** the uploaded ZIP contains zero non-directory entries
- **THEN** the response is `{ "results": [] }`, not an error

#### Scenario: Non-ZIP file is rejected

- **WHEN** the uploaded file is not a valid ZIP archive
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Archive exceeding the byte-size limit is rejected

- **WHEN** the uploaded archive's request body exceeds `ARCHIVE_UPLOAD_MAX_BYTES`
- **THEN** the endpoint returns `413 Payload Too Large`

#### Scenario: Archive exceeding the file-count limit is rejected

- **WHEN** the archive contains more non-directory entries than `ARCHIVE_UPLOAD_MAX_FILES`
- **THEN** the endpoint returns `422 Unprocessable Entity` and no entries are uploaded
- **AND** extraction/upload does not start for any entry: no entry read stream is opened and no DIAL Core create-only upload is attempted
- **AND** the response message names the file-count check, e.g. `Archive contains more than 1000 files` when the default limit is used

#### Scenario: Archive with too many total entries is rejected

- **WHEN** the archive's total entry count, directories included, exceeds `ARCHIVE_UPLOAD_MAX_FILES * 10`
- **THEN** the endpoint returns `422 Unprocessable Entity` with the message `Archive contains too many entries` and no entries are uploaded

#### Scenario: Archive exceeding the uncompressed-size limit is rejected mid-extraction

- **WHEN** cumulative decompressed bytes across entries exceeds `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` partway through extraction
- **THEN** extraction is aborted, the endpoint returns `422 Unprocessable Entity`, and any entries already uploaded before the abort remain (no rollback, matching the partial-failure posture of `/copy`/`/move` folder operations)

#### Scenario: Conflicting entry is uploaded with a deduplicated name

- **WHEN** one entry's destination path already exists and DIAL Core returns 412 for that entry's `create-only` upload
- **THEN** the service retries the same entry using the next available deduplicated sibling name, such as `reports/archive/q1 (1).pdf`
- **AND** the entry's result is `{ "path": "reports/archive/q1 (1).pdf", "success": true }`
- **AND** the remaining entries are still processed

#### Scenario: Deduplicated name also conflicts

- **WHEN** an entry's original path and first deduplicated path both already exist
- **THEN** the service continues retrying with incremented suffixes, such as `reports/archive/q1 (2).pdf`, until an available name is created

### Requirement: Upload-archive observability

`FilesArchiveUploadService` SHALL emit structured log lines at the start and end of `uploadArchive`, including `entryCount`, `successCount`, and `failedCount`. Log lines SHALL NOT include archive entry file names, file contents, or the destination path beyond what is already logged for ordinary uploads.

#### Scenario: Upload-archive call logged on start and completion

- **WHEN** `uploadArchive` is called with an archive containing N entries
- **THEN** a `log` line records `entryCount=N` at start, and another records `successCount`/`failedCount` at completion
