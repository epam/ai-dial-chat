## MODIFIED Requirements

### Requirement: Upload file to DIAL Core via BFF
The system SHALL expose `POST /api/v1/files` accepting a `multipart/form-data` request with a `file` field (binary), `bucket` and `path` form fields, and an optional `uploadMode` field. The endpoint SHALL validate all inputs, apply conditional DIAL Core headers based on `uploadMode`, and proxy the upload to DIAL Core `PUT /v1/files/{bucket}/{path}` (a streamed multipart request issued by `FilesUploadService` in `apps/chat-api/src/files/upload/files-upload.service.ts`, using the same raw-`fetch` upload helper as archive entries because the DIAL SDK upload helper requires a whole `FormData`/`Blob`) under the authenticated user's session. The endpoint SHALL return `201 Created` with a `FileUploadResponseDto` on success.

The handler MUST NOT hold the file in memory. The `file` part SHALL be staged to a temporary file under `os.tmpdir()` by `FileUploadInterceptor`, which shares its implementation with `ArchiveUploadInterceptor` through `DiskFileUploadInterceptor` (`apps/chat-api/src/files/disk-file-upload.interceptor.ts`), with multer `limits.fileSize` drawn from the `FILE_UPLOAD_MAX_BYTES` environment variable (default 512 MB) and `limits.files` of 1. The staged file SHALL be streamed from disk to DIAL Core in bounded chunks so the transfer can be observed for progress, and SHALL be deleted when the request finishes — on success, on any error, and when multer rejects the request. A partially written file from an aborted request SHALL NOT remain on disk.

Every streamed PUT to DIAL Core (single files and archive entries) SHALL carry a `Content-Length` header equal to the exact byte length of the multipart body sent (envelope plus file bytes), so DIAL Core applies its own `storage.maxUploadedFileSize` check. A DIAL Core `413` SHALL be returned to the browser as `413 Payload Too Large`.

- **Swagger**: `@ApiConsumes('multipart/form-data')` and `@ApiBody` with schema describing `file`, `bucket`, `path`, and optional `uploadMode` fields.
- **operationId**: `uploadFile` → generated SDK method `filesApi.uploadFile(...)`.
- **Request content-type**: `multipart/form-data`
- **Response content-type**: `application/json`

**Request form fields:**
| Field | Type | Validation |
|-------|------|------------|
| `file` | binary | Required; max size enforced by multer |
| `bucket` | string | Required; `@Matches(BUCKET_NAME_PATTERN)` (`/^[\w.-]+$/`), up to 256 characters |
| `path` | string | Required; `@IsValidFilePath()`, up to 1024 characters |
| `uploadMode` | `'overwrite' \| 'create-only'` | Optional; `@IsOptional()`, `@IsString()`, `@IsIn(['overwrite', 'create-only'])`; defaults to `'overwrite'` |

**Upload mode → DIAL Core header mapping:**
| `uploadMode` | DIAL Core header |
|---|---|
| `'overwrite'` or absent | No conditional header (existing behavior — overwrites any existing file) |
| `'create-only'` | `If-None-Match: *` (fails with 412 if file already exists at path) |

`path` is a bucket-relative URL path. Clients may percent-encode each file-name
segment (for example, `uploads/2026-09/my%20report%20%23%201.pdf`). Before
calling DIAL Core, the BFF SHALL decode every segment once and encode it once
again (`encodeDialResourcePath`). The returned `url` is built from the
validated request `path` as received (`buildDialFileUrl`), so a pre-encoded
path comes back in that same single-encoded form.
Malformed percent escapes, encoded separators or dots (`%2E`, `%2F`, `%5C`),
raw backslashes, leading slashes, and traversal segments remain invalid.

**DIAL Core 412 handling for `create-only`:** When DIAL Core returns `412 Precondition Failed` in response to `If-None-Match: *`, the BFF SHALL map this to `409 Conflict` with body `{ "message": "File already exists at this path" }`. This indicates a race condition (file was created by another request after the client checked) and SHALL be surfaced as an upload failure for that file.

**Transfer limits:** the transfer to DIAL Core SHALL be bounded by progress, not by one absolute timer. It SHALL be aborted when (a) no data has been handed to the connection for `FILE_TRANSFER_TIMEOUT_MS` (stalled), (b) DIAL Core has not answered 2 minutes after the last chunk was handed over, or (c) the whole transfer has run for 30 minutes. A slow transfer that keeps making progress SHALL NOT be aborted by (a), however long it takes, until (c). Limits (b) and (c) are fixed and not configurable. Each abort returns `503 Service Unavailable` with a message naming the cause (stalled / DIAL Core did not respond / maximum duration), not `DIAL Core is unreachable`.

**Success response (201):** `FileUploadResponseDto`
```json
{ "url": "files/{bucket}/{path}" }
```

**Error codes:** 400, 401, 403, 409, 413, 429, 502, 503, 500.

**Generated-client impact:** none from this change — request and response shapes, status codes and `operationId` are unchanged. Generated method `filesApi.uploadFile({ file, bucket, path, uploadMode? })`. Frontend callers in `apps/chat/src/server-api/files.api.ts` (via `createFilesApiClient` from `@epam/ai-dial-chat-hooks`) and `upload-file-with-progress.ts` (via `createUploadFileWithProgress`) pass `uploadMode` through.

**XHR progress path:** `uploadFileWithProgress` in `apps/chat/src/server-api/upload-file-with-progress.ts` is built by `createUploadFileWithProgress` (`libs/chat-hooks/src/files/create-upload-file-with-progress.ts`), which SHALL add `uploadMode` to the `FormData` when provided via `UploadFileWithProgressOptions`. The `UploadFileWithProgressOptions` type (`libs/chat-hooks/src/files/create-files-api.ts`) carries `uploadMode?: UploadMode` (`'overwrite' | 'create-only'`).

#### Scenario: Successful overwrite upload
- **WHEN** an authenticated user sends `POST /api/v1/files` with `uploadMode: 'overwrite'` (or omits the field)
- **THEN** the BFF forwards to DIAL Core without `If-None-Match`
- **AND** DIAL Core overwrites any existing file at that path
- **AND** the BFF returns `201 Created`

#### Scenario: Upload a percent-encoded file name
- **WHEN** an authenticated user uploads a file with the path
  `uploads/2026-09/my%20report%20%23%201.pdf`
- **THEN** the BFF forwards exactly
  `uploads/2026-09/my%20report%20%23%201.pdf` to DIAL Core
- **AND** the success response has a `url` containing that same single-encoded path

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
- **THEN** multer rejects the request and the system returns `413 Payload Too Large` with the message `File too large`
- **AND** no temporary file remains on disk

#### Scenario: Staged file is removed after the request
- **WHEN** a `POST /api/v1/files` request finishes — with `201`, with an error mapped from DIAL Core, or with a transfer abort
- **THEN** the temporary file the request was staged to no longer exists

#### Scenario: Exact Content-Length is sent to DIAL Core
- **WHEN** a file of N bytes is uploaded
- **THEN** the PUT to DIAL Core carries `Content-Length` equal to the multipart preamble length + N + the multipart epilogue length
- **AND** the request is not sent with `Transfer-Encoding: chunked`

#### Scenario: DIAL Core rejects the size
- **WHEN** DIAL Core answers the PUT with `413` because the body exceeds its `storage.maxUploadedFileSize`
- **THEN** the system returns `413 Payload Too Large`

#### Scenario: DIAL Core returns 403
- **WHEN** DIAL Core responds with `403 Forbidden` (user lacks permission for the bucket)
- **THEN** the system returns `403 Forbidden` to the browser

#### Scenario: DIAL Core returns 429
- **WHEN** DIAL Core rate-limits the request
- **THEN** the system returns `429 Too Many Requests` to the browser

#### Scenario: DIAL Core is unreachable
- **WHEN** the connection to DIAL Core is refused or fails before any transfer limit is hit
- **THEN** the system returns `503 Service Unavailable`

#### Scenario: Large upload slower than the old absolute timeout
- **WHEN** a file whose transfer to DIAL Core takes longer than `FILE_TRANSFER_TIMEOUT_MS` is uploaded
- **AND** data keeps being accepted by the connection (each gap shorter than `FILE_TRANSFER_TIMEOUT_MS`)
- **THEN** the upload completes and the BFF returns `201 Created`

#### Scenario: Transfer stalls
- **WHEN** no data is accepted by the connection to DIAL Core for `FILE_TRANSFER_TIMEOUT_MS`
- **THEN** the request to DIAL Core is aborted
- **AND** the system returns `503 Service Unavailable` with a message stating the upload stalled

#### Scenario: DIAL Core does not respond after the file is sent
- **WHEN** the whole file has been handed to the connection and DIAL Core does not answer within 2 minutes
- **THEN** the request to DIAL Core is aborted
- **AND** the system returns `503 Service Unavailable` with a message stating DIAL Core did not respond

#### Scenario: Maximum transfer duration reached
- **WHEN** one transfer to DIAL Core runs for 30 minutes, even though data is still flowing
- **THEN** the request to DIAL Core is aborted
- **AND** the system returns `503 Service Unavailable` with a message stating the maximum duration was exceeded

#### Scenario: DIAL Core returns unexpected 5xx
- **WHEN** DIAL Core returns a 5xx status code
- **THEN** the system logs the error and returns `502 Bad Gateway`

## ADDED Requirements

### Requirement: The BFF accepts slow request bodies up to the upload ceiling
The NestJS HTTP server SHALL set Node's `requestTimeout` to `UPLOAD_MAX_DURATION_MS` (30 minutes, exported from `apps/chat-api/src/files/upload/upload-watchdog.ts`) through `configureHttpServerTimeouts` (`apps/chat-api/src/common/utils/http-server-timeouts.ts`), called from `apps/chat-api/src/main.ts`, so that a request body which keeps arriving is not cut at Node's 5-minute default. `headersTimeout` SHALL keep Node's default.

#### Scenario: Slow upload longer than five minutes
- **WHEN** a browser sends a `POST /api/v1/files` body that keeps arriving for longer than 5 minutes and finishes within 30 minutes
- **THEN** the BFF receives the whole body and processes the upload instead of answering `408 Request Timeout`

#### Scenario: Server timeouts are configured
- **WHEN** `configureHttpServerTimeouts` is applied to an HTTP server
- **THEN** its `requestTimeout` equals `UPLOAD_MAX_DURATION_MS`
- **AND** its `headersTimeout` is unchanged
