## ADDED Requirements

### Requirement: POST /api/v1/files/upload-archive endpoint

The BFF SHALL expose `POST /api/v1/files/upload-archive` (multipart/form-data) that accepts a ZIP archive and a destination, streams-extracts its entries via `yauzl`, and uploads each valid entry to DIAL Core using the create-only contract. If DIAL Core reports a name collision for an entry, the service SHALL retry that same entry with a deduplicated sibling name (`name (1).ext`, `name (2).ext`, etc.) until the upload succeeds or the retry limit is reached. The endpoint returns a per-entry result array with the final uploaded path for successful entries.

The file-count limit SHALL be enforced before extraction/upload starts. `FilesUploadService` SHALL enumerate ZIP central-directory metadata and count non-directory entries before opening any entry read stream, staging entry bytes, or calling DIAL Core upload. If the count exceeds `ARCHIVE_UPLOAD_MAX_FILES`, the endpoint SHALL fail with `422 Unprocessable Entity`, return the message `Archive contains more than {maxFiles} files`, and attempt zero entry uploads. This all-or-nothing rule applies only to the file-count limit; the uncompressed-size limit remains a mid-extraction guard and may leave entries uploaded before the abort.

**State ownership**: `FilesUploadService` (`apps/chat-api/src/files/upload/files-upload.service.ts`) owns all extraction/upload logic, including single-file upload (`uploadFile`, `uploadFileStream`) and archive extraction (`extractAndUploadArchive` and its temp-file staging helpers); `FilesController` delegates through the `FilesService` facade (thin-controller pattern).

**Authorization**: session cookie → `req.user.at`, identical to `POST /api/v1/files`. Core enforces WRITE permission on the destination per entry, surfaced as a per-entry `"Forbidden"` result (matching how `/copy`/`/move` surface per-item Core-side authorization failures).

**Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })` — matching `/download-archive`'s stricter limit (archive operations are heavier than single-file operations).

**Caching**: no NestJS cache read/write. Frontend-side folder-listing cache for the parent destination folder is invalidated by the hook on completion so the archive-named child folder appears in the refreshed listing.

#### Request

Multipart fields: `file` (the ZIP, binary), `bucket` (string), `destinationPath` (string, relative path within bucket — the final folder entries are extracted into). The frontend SHALL pass an archive-named child folder as `destinationPath`; for example, uploading `archive.zip` from `reports/` calls the endpoint with `destinationPath: "reports/archive/"`, using the ui-kit's prepared archive name without the `.zip` extension.

**`UploadArchiveDto`** (`apps/chat-api/src/files/dto/upload-archive.dto.ts`, describes the non-file fields for Swagger/validation):

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(BUCKET_NAME_PATTERN) @MaxLength(256)` | DIAL Core bucket |
| `destinationPath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Destination folder, relative to bucket |

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

`FilesUploadService` SHALL emit structured log lines at the start and end of `uploadArchive`, including `entryCount`, `successCount`, and `failedCount`. Log lines SHALL NOT include archive entry file names, file contents, or the destination path beyond what is already logged for ordinary uploads.

#### Scenario: Upload-archive call logged on start and completion

- **WHEN** `uploadArchive` is called with an archive containing N entries
- **THEN** a `log` line records `entryCount=N` at start, and another records `successCount`/`failedCount` at completion

---

### Requirement: onUploadArchive wired on useDialFileManager

`useDialFileManager` SHALL expose `onUploadArchive(file: File, name: string, destinationFolder: string)`, wired to ui-kit's `DialFileManager.onUploadArchive` prop, that resolves `destinationFolder` to the parent API folder path (same resolution as `onUploadFiles`), appends the provided archive `name` as a trailing-slashed child folder, and calls the new `uploadArchive` server-api wrapper with that archive-named `destinationPath`.

If the ui-kit's archive conflict resolver falls back to `onUploadFiles` because the browser reports a ZIP with an empty or non-standard MIME type, `useDialFileManager` SHALL detect the single-file shape `{ fileContent.name: "*.zip", name: "<archive-folder-name>" }` and route it back through the archive upload path instead of uploading the ZIP as a normal file.

**State ownership**: `onUploadArchive` reuses the hook's existing `uploadBatchState` (no new progress-state shape is introduced) to represent the in-flight archive upload as a single indeterminate item, since the BFF returns one aggregated result rather than per-entry progress events.

**Cache invalidation**: on completion, the hook invalidates the cache entry for the parent destination folder and increments `retryCounter`, matching `onUploadFiles`. The archive-named child folder's contents are fetched only after the user opens that folder.

**Notifications**: request-level failure (network/validation error, non-ZIP, oversized archive, timeout) surfaces via `onNotification(NotificationVariant.Error, ...)` with the generic archive-upload error because no per-entry result list is available. If the request succeeds but every entry in `results` failed, the hook surfaces an all-failed archive-entry message containing the failed file list. Partial failure (some entries failed) surfaces via a distinct partial-failure message containing the failed count and failed file list, matching the `CopyPartialError`/`MovePartialError` convention while adding actionable file names. Full success shows no toast — the archive-named child folder appearing in the refreshed parent listing is the confirmation.

The failed file list SHALL be built from failed `UploadArchiveEntryResultDto` entries as `path` or `path (error)` when an entry includes an error. The list SHALL display at most five entries and append the existing `dialFileManager.andOtherItems` label for the remaining count.

**Memoisation**: archive upload handling SHALL be memoised with dependencies that include `bucket`, `rootLabel`, `onNotification`, and `t`; `onUploadArchive` MAY delegate to that memoised handler.

#### Scenario: Successful archive upload refreshes the parent destination folder

- **WHEN** `onUploadArchive` receives `name: "archive"` and `destinationFolder: "/My files/reports"` and completes with all entries successful
- **THEN** `uploadArchive` is called with `destinationPath: "reports/archive/"`
- **AND** the parent destination folder's cache entry (`reports/`) is cleared, `retryCounter` increments, and no toast is shown

#### Scenario: Archive conflict fallback does not create a normal ZIP file

- **GIVEN** the selected archive file is `archive.zip`
- **AND** the ui-kit resolves an archive-name conflict and calls `onUploadFiles` with one item named `archive` or `archive (1)`
- **WHEN** `useDialFileManager` handles that callback
- **THEN** it calls `uploadArchive` with `destinationPath: "reports/archive/"` or `destinationPath: "reports/archive (1)/"`
- **AND** it does not call the normal single-file upload wrapper

#### Scenario: Partial archive upload failure shows a toast with failed files

- **WHEN** `onUploadArchive` completes with some entries failed
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a message reporting the failed count and failed file list

#### Scenario: All returned archive entries fail

- **WHEN** `onUploadArchive` completes with a non-empty `results` array and every entry failed
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a message listing the failed files

#### Scenario: Request-level archive upload failure shows a generic toast

- **WHEN** the `uploadArchive` request itself rejects (network error, non-ZIP, oversized)
- **THEN** `onNotification` is called once with `NotificationVariant.Error`

---

### Requirement: Archive entry conflicts are resolved server-side

Archive entry name collisions SHALL NOT depend on the ui-kit's upload conflict popup. The ui-kit can only compare the selected archive file's prepared name against the currently loaded destination folder items before calling `onUploadArchive`; it does not inspect the ZIP contents. Therefore, conflicts for files inside the archive SHALL be resolved by the BFF during extraction/upload using the DIAL Core create-only response as the source of truth.

If the ui-kit opens its conflict popup during archive selection, that popup concerns only the selected archive name prepared by the ui-kit and SHALL NOT be treated as resolution for entries inside the archive. When the user proceeds from that popup, `onUploadArchive` SHALL send the selected archive and archive-named destination path to the BFF, and the BFF SHALL perform per-entry deduplication. If the user cancels the popup, no archive upload request is made.

#### Scenario: Existing file inside archive destination does not require a popup

- **GIVEN** the archive-named destination folder contains `reports/archive/reports/q1.pdf`
- **AND** the selected archive contains `reports/q1.pdf`
- **WHEN** the archive upload runs
- **THEN** the BFF uploads the entry as `reports/archive/reports/q1 (1).pdf` or the next available deduplicated name
- **AND** no frontend replace/duplicate decision is required for that archive entry

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

The following base keys SHALL be represented in `DialFileManagerI18nKeys` (`apps/chat/src/constants/translation-keys.ts`) and `apps/chat/src/i18n/locales/en.json`. Pluralized archive-entry failure messages SHALL use i18next `_one` / `_other` locale entries while frontend code calls the base key.

| Base key | Locale entry / English value (example) |
|----------|----------------------------------------|
| `dialFileManager.uploadArchiveAction` | `Upload archive` |
| `dialFileManager.uploadArchiveError` | `Failed to upload the archive` |
| `dialFileManager.uploadArchiveFilesError` | `_one`: `Failed to upload this archive file: {{files}}`; `_other`: `Failed to upload these archive files: {{files}}` |
| `dialFileManager.uploadArchivePartialError` | `_one`: `{{count}} item in the archive could not be uploaded: {{files}}`; `_other`: `{{count}} items in the archive could not be uploaded: {{files}}` |
| `dialFileManager.andOtherItems` | Reused to append hidden failed-file counts when more than five entries fail |

#### Scenario: Upload-archive toolbar label uses i18n key

- **WHEN** the upload-archive toolbar entry is rendered
- **THEN** its label is produced via `t(DialFileManagerI18nKeys.UploadArchiveAction)`, not a raw string literal

---

### Requirement: No feature-flag gating

Upload archive SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with the other file-manager actions. Visibility is gated only by `variant`/`actionProfile`.

#### Scenario: Upload archive is available without a feature flag

- **WHEN** the standalone page has `actionProfile: Full`
- **THEN** the upload-archive toolbar entry is available without checking any `ENABLED_FEATURES` entry
