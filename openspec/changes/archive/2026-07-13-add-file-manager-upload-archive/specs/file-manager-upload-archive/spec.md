# Spec: file-manager-upload-archive

## ADDED Requirements

### Requirement: POST /api/v1/files/upload-archive endpoint

The BFF SHALL expose `POST /api/v1/files/upload-archive` (multipart/form-data) that accepts a ZIP archive and a destination, streams-extracts its entries via `yauzl`, and uploads each valid entry to DIAL Core via the existing `FilesService.uploadFile(bucket, path, file, token, 'create-only')`, returning a per-entry result array.

**State ownership**: `FilesService` owns all extraction/upload logic; `FilesController` delegates (thin-controller pattern).

**Authorization**: session cookie → `req.user.at`, identical to `POST /api/v1/files`. Core enforces WRITE permission on the destination per entry, surfaced as a per-entry `"Forbidden"` result (matching how `/copy`/`/move` surface per-item Core-side authorization failures).

**Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })` — matching `/download-archive`'s stricter limit (archive operations are heavier than single-file operations).

**Caching**: no NestJS cache read/write. Frontend-side folder-listing cache for the destination folder is invalidated by the hook on completion.

#### Request

Multipart fields: `file` (the ZIP, binary), `bucket` (string), `destinationPath` (string, relative path within bucket — the folder entries are extracted into).

**`UploadArchiveDto`** (`apps/chat-api/src/files/dto/upload-archive.dto.ts`, describes the non-file fields for Swagger/validation):

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(BUCKET_NAME_PATTERN) @MaxLength(256)` | DIAL Core bucket |
| `destinationPath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Destination folder, relative to bucket |

#### Response DTO

**`UploadArchiveEntryResultDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Destination path of the extracted entry (relative to bucket) |
| `success` | `boolean` | `true` when the entry was extracted and uploaded successfully |
| `error` | `string?` | Human-readable error reason when `success` is `false` |

**`UploadArchiveResponseDto`**: `{ results: UploadArchiveEntryResultDto[] }`

#### Controller signature

```typescript
@Post('upload-archive')
@HttpCode(200)
@Throttle({ default: { limit: 5, ttl: 60000 } })
@UseInterceptors(FileInterceptor('file'))
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
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable, timed out, or ARCHIVE_UPLOAD_TIMEOUT_MS exceeded' })
uploadArchive(
  @UploadedFile() file: { buffer: Buffer; mimetype: string },
  @Body() body: UploadArchiveDto,
  @Req() req: Request,
): Promise<UploadArchiveResponseDto>
```

#### Generated-client impact

- **operationId**: derived from handler name `uploadArchive` → `filesApi.uploadArchive({ file, bucket, destinationPath })`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `uploadArchive(file: File, bucket: string, destinationPath: string): Promise<UploadArchiveResponseDto>` using the normal (non-`Raw`) generated method.

**Example response**:
```json
{
  "results": [
    { "path": "reports/q1.pdf", "success": true },
    { "path": "reports/q2.pdf", "success": false, "error": "Conflict" }
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

#### Scenario: Archive exceeding the uncompressed-size limit is rejected mid-extraction

- **WHEN** cumulative decompressed bytes across entries exceeds `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` partway through extraction
- **THEN** extraction is aborted, the endpoint returns `422 Unprocessable Entity`, and any entries already uploaded before the abort remain (no rollback, matching the partial-failure posture of `/copy`/`/move` folder operations)

#### Scenario: Conflicting entry is reported as a failed result, extraction continues

- **WHEN** one entry's destination path already exists and DIAL Core returns 412 for that entry's `create-only` upload
- **THEN** that entry's result is `{ success: false, error: "Conflict" }` and the remaining entries are still processed

---

### Requirement: Zip-slip path-safety validation

Every archive entry SHALL be rejected (recorded as a failed result, not extracted) if its raw entry name is an absolute path, contains a `..` path segment after normalization, or contains a backslash (`\`) character. Directory entries SHALL be skipped silently (neither extracted nor reported as failed or successful results).

#### Scenario: Entry with a parent-directory traversal segment is rejected

- **WHEN** an archive entry's name is `../../etc/passwd`
- **THEN** that entry is not extracted and appears in `results` as `{ success: false, error: "Invalid path" }`

#### Scenario: Entry with an absolute path is rejected

- **WHEN** an archive entry's name is `/etc/passwd` or `C:\Windows\System32\config`
- **THEN** that entry is not extracted and appears in `results` as `{ success: false, error: "Invalid path" }`

#### Scenario: Directory entries are skipped without a result entry

- **WHEN** an archive contains a directory entry (e.g. `reports/`)
- **THEN** no corresponding item appears in `results` — it is neither extracted nor reported as a failure

#### Scenario: Valid nested file path is extracted correctly

- **WHEN** an archive entry's name is `reports/2026/q1.pdf`
- **THEN** the file is uploaded to `{destinationPath}/reports/2026/q1.pdf` and appears in `results` with `success: true`

---

### Requirement: Upload-archive environment configuration

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare `ARCHIVE_UPLOAD_MAX_BYTES`, `ARCHIVE_UPLOAD_MAX_FILES`, `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES`, and `ARCHIVE_UPLOAD_TIMEOUT_MS`, each optional with a documented default and `@IsInt @Min(1)` validation, distinct from the existing download-archive env vars (`ARCHIVE_MAX_ITEMS`, `ARCHIVE_MAX_FILES`, `ARCHIVE_MAX_UNCOMPRESSED_BYTES`, `ARCHIVE_TIMEOUT_MS`, `ARCHIVE_DOWNLOAD_CONCURRENCY`).

#### Scenario: Missing upload-archive env vars fall back to documented defaults

- **WHEN** none of the four new env vars are set
- **THEN** the app boots successfully using the documented defaults (512 MB / 1000 files / 2 GB / 5 min)

#### Scenario: Invalid env var value fails fast at boot

- **WHEN** `ARCHIVE_UPLOAD_MAX_FILES` is set to a non-numeric value
- **THEN** the application fails to start with a validation error (matching the existing `validate()` fail-fast behavior for all other numeric env vars)

---

### Requirement: Upload-archive observability

`FilesService` SHALL emit structured log lines at the start and end of `uploadArchive`, including `entryCount`, `successCount`, and `failedCount`. Log lines SHALL NOT include archive entry file names, file contents, or the destination path beyond what is already logged for ordinary uploads.

#### Scenario: Upload-archive call logged on start and completion

- **WHEN** `uploadArchive` is called with an archive containing N entries
- **THEN** a `log` line records `entryCount=N` at start, and another records `successCount`/`failedCount` at completion

---

### Requirement: onUploadArchive wired on useDialFileManager

`useDialFileManager` SHALL expose `onUploadArchive(file: File, name: string, destinationFolder: string)`, wired to ui-kit's `DialFileManager.onUploadArchive` prop, that resolves `destinationFolder` to `{ bucket, destinationPath }` (same resolution as `onUploadFiles`) and calls the new `uploadArchive` server-api wrapper.

**State ownership**: `onUploadArchive` reuses the hook's existing `uploadBatchState` (no new progress-state shape is introduced) to represent the in-flight archive upload as a single indeterminate item, since the BFF returns one aggregated result rather than per-entry progress events.

**Cache invalidation**: on completion, the hook invalidates the cache entry for the destination folder and increments `retryCounter`, matching `onUploadFiles`.

**Notifications**: full failure (network/validation error, or every entry in `results` failed) surfaces via `onNotification(NotificationVariant.Error, ...)`. Partial failure (some entries failed) surfaces via a distinct partial-failure message reporting the failed count, matching the `CopyPartialError`/`MovePartialError` convention. Full success shows no toast — the extracted files appearing in the refreshed listing is the confirmation.

**Memoisation**: `onUploadArchive` SHALL be a `useCallback` with dependencies `[bucket, onNotification, t]`.

#### Scenario: Successful archive upload refreshes the destination folder

- **WHEN** `onUploadArchive` completes with all entries successful
- **THEN** the destination folder's cache entry is cleared, `retryCounter` increments, and no toast is shown

#### Scenario: Partial archive upload failure shows a toast with the failed count

- **WHEN** `onUploadArchive` completes with some entries failed
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a message reporting the failed count

#### Scenario: Full archive upload failure shows a toast

- **WHEN** the `uploadArchive` request itself rejects (network error, non-ZIP, oversized)
- **THEN** `onNotification` is called once with `NotificationVariant.Error`

---

### Requirement: Upload-archive toolbar action, standalone-only

`DialFileManagerShell` SHALL populate `toolbarOptions.newActions.uploadArchive` (label + icon) only when `variant === DialFileManagerVariant.Standalone` and `actionProfile === DialFileManagerActionProfile.Full`. The attach modal (`variant === Attach`) SHALL NOT receive this new-action entry.

#### Scenario: Standalone page with Full profile shows the upload-archive toolbar entry

- **WHEN** `DialFileManagerPage` renders with `actionProfile: Full`
- **THEN** `toolbarOptions.newActions.uploadArchive` is present

#### Scenario: Attach modal never shows the upload-archive toolbar entry

- **WHEN** `DialFileManagerModal` renders (attach flow)
- **THEN** `toolbarOptions.newActions.uploadArchive` is `undefined`

---

### Requirement: i18n keys for upload archive

The following keys SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching members added to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`:

| Key | English value (example) |
|-----|--------------------------|
| `dialFileManager.uploadArchiveAction` | `Upload archive` |
| `dialFileManager.uploadArchiveError` | `Failed to upload the archive` |
| `dialFileManager.uploadArchivePartialError` | `{{count}} item(s) in the archive could not be uploaded` |

#### Scenario: Upload-archive toolbar label uses i18n key

- **WHEN** the upload-archive toolbar entry is rendered
- **THEN** its label is produced via `t(DialFileManagerI18nKeys.UploadArchiveAction)`, not a raw string literal

---

### Requirement: No feature-flag gating

Upload archive SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with the other file-manager actions. Visibility is gated only by `variant`/`actionProfile`.

#### Scenario: Upload archive is available without a feature flag

- **WHEN** the standalone page has `actionProfile: Full`
- **THEN** the upload-archive toolbar entry is available without checking any `ENABLED_FEATURES` entry
