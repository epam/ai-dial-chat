## MODIFIED Requirements

### Requirement: Upload file to DIAL Core via BFF
The system SHALL expose `POST /api/v1/files` accepting a `multipart/form-data` request with a `file` field (binary), `bucket` and `path` form fields, and an optional `uploadMode` field. The endpoint SHALL validate all inputs, apply conditional DIAL Core headers based on `uploadMode`, and proxy the upload to DIAL Core `PUT /v1/files/{bucket}/{path}` under the authenticated user's session. The endpoint SHALL return `201 Created` with a `FileUploadResponseDto` on success.

The handler MUST NOT store the file on disk; it SHALL stream the in-memory buffer to DIAL Core immediately. The multer `memoryStorage` engine MUST be used with `limits.fileSize` drawn from the `FILE_UPLOAD_MAX_BYTES` environment variable (default 512 MB).

- **Rate limit**: `@Throttle({ default: { limit: 100, ttl: 60000 } })` (updated from 20/min to match actual throttle in controller).
- **Swagger**: `@ApiConsumes('multipart/form-data')` and `@ApiBody` with schema describing `file`, `bucket`, `path`, and optional `uploadMode` fields.
- **operationId**: `uploadFile` → generated SDK method `filesApi.uploadFile(...)`.
- **Request content-type**: `multipart/form-data`
- **Response content-type**: `application/json`

**Request form fields:**
| Field | Type | Validation |
|-------|------|------------|
| `file` | binary | Required; max size enforced by multer |
| `bucket` | string | Required; `@Matches(/^[\w.-]+$/)` |
| `path` | string | Required; `@IsValidFilePath()` |
| `uploadMode` | `'overwrite' \| 'create-only'` | Optional; `@IsOptional()`, `@IsIn(['overwrite', 'create-only'])`; defaults to `'overwrite'` |

**Upload mode → DIAL Core header mapping:**
| `uploadMode` | DIAL Core header |
|---|---|
| `'overwrite'` or absent | No conditional header (existing behavior — overwrites any existing file) |
| `'create-only'` | `If-None-Match: *` (fails with 412 if file already exists at path) |

**DIAL Core 412 handling for `create-only`:** When DIAL Core returns `412 Precondition Failed` in response to `If-None-Match: *`, the BFF SHALL map this to `409 Conflict` with body `{ "message": "File already exists at this path" }`. This indicates a race condition (file was created by another request after the client checked) and SHALL be surfaced as an upload failure for that file.

**Success response (201):** `FileUploadResponseDto`
```json
{ "url": "dial:///files/{bucket}/{path}" }
```

**Error codes:** 400, 401, 403, 409, 413, 429, 502, 503, 500.

**Generated-client impact:** OpenAPI regeneration adds `uploadMode` to the `uploadFile` request body schema. Generated method `filesApi.uploadFile({ file, bucket, path, uploadMode? })`. Frontend callers in `apps/chat/src/server-api/files.api.ts` and `upload-file-with-progress.ts` pass `uploadMode` through.

**XHR progress path:** `uploadFileWithProgress` in `apps/chat/src/server-api/upload-file-with-progress.ts` SHALL add `uploadMode` to the `FormData` when provided via `UploadFileWithProgressOptions`. The `UploadFileWithProgressOptions` type gains `uploadMode?: 'overwrite' | 'create-only'`.

#### Scenario: Successful overwrite upload
- **WHEN** an authenticated user sends `POST /api/v1/files` with `uploadMode: 'overwrite'` (or omits the field)
- **THEN** the BFF forwards to DIAL Core without `If-None-Match`
- **AND** DIAL Core overwrites any existing file at that path
- **AND** the BFF returns `201 Created`

#### Scenario: Successful create-only upload (path free)
- **WHEN** an authenticated user sends `POST /api/v1/files` with `uploadMode: 'create-only'`
- **AND** no file exists at the given path in DIAL Core
- **THEN** the BFF forwards `If-None-Match: *` to DIAL Core
- **AND** DIAL Core creates the file
- **AND** the BFF returns `201 Created`

#### Scenario: Create-only upload — race condition (path taken)
- **WHEN** an authenticated user sends `POST /api/v1/files` with `uploadMode: 'create-only'`
- **AND** a file already exists at the given path in DIAL Core (race condition)
- **THEN** DIAL Core returns `412 Precondition Failed`
- **AND** the BFF maps this to `409 Conflict` with body `{ "message": "File already exists at this path" }`
- **AND** the frontend surfaces this as a `Failed` status for that file in the upload progress modal

#### Scenario: Invalid uploadMode value
- **WHEN** the `uploadMode` field contains a value other than `'overwrite'` or `'create-only'`
- **THEN** the BFF returns `400 Bad Request` with a validation error

#### Scenario: Unauthenticated upload attempt
- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before forwarding anything to DIAL Core

#### Scenario: File exceeds size limit
- **WHEN** the uploaded file exceeds `FILE_UPLOAD_MAX_BYTES`
- **THEN** multer rejects the request and the system returns `413 Payload Too Large`
