# Spec: File Upload

## Purpose

Uploading a file to DIAL Core through the BFF, with DTO validation and environment configuration.

## Requirements

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

---

### Requirement: Upload DTO validation
The system SHALL parse and validate the `bucket` and `path` form fields through a `UploadFileDto` class decorated with `class-validator` and `@ApiProperty`. The global `ValidationPipe` (whitelist + forbidNonWhitelisted) MUST reject a request that carries any undeclared field with `400 Bad Request`, so the request never reaches the handler.

The `UploadFileDto` SHALL be defined at `apps/chat-api/src/files/dto/upload-file.dto.ts`; it extends `FileParamsDto` (`apps/chat-api/src/files/dto/file-params.dto.ts`), which declares `bucket` and `path`, and adds the optional `uploadMode`.

- `bucket`: `@IsString()`, `@IsNotEmpty()`, `@Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })` (`/^[\w.-]+$/`, from `apps/chat-api/src/common/validators/bucket-name.pattern.ts`), `@MaxLength(256)`
- `path`: `@IsString()`, `@IsNotEmpty()`, `@MaxLength(1024)`, and `@IsValidFilePath()`; percent-encoded filename characters are valid, while a leading `/`, `..`, malformed percent escapes, encoded separators/dots, and raw forbidden path characters are rejected

#### Scenario: Valid DTO passes validation
- **WHEN** `bucket` is `my-bucket` and `path` is `folder/file.txt`
- **THEN** the DTO instantiates successfully and the handler receives the validated object

#### Scenario: Empty bucket rejected
- **WHEN** `bucket` is an empty string
- **THEN** `ValidationPipe` returns `400 Bad Request` with an error message identifying the `bucket` field

#### Scenario: Extra fields rejected
- **WHEN** the form body includes an undeclared field such as `admin: true`
- **THEN** `ValidationPipe` returns `400 Bad Request` with the message `property admin should not exist`
- **AND** the request does not reach the service layer

---

### Requirement: Upload environment configuration
The system SHALL add `FILE_UPLOAD_MAX_BYTES` and `FILE_TRANSFER_TIMEOUT_MS` to `EnvironmentVariables` with sensible defaults and class-validator decorators.

- `FILE_UPLOAD_MAX_BYTES`: `@IsOptional()`, `@Transform(parseInt)`, `@IsInt()`, `@Min(1)`, default `536_870_912` (512 MB).
- `FILE_TRANSFER_TIMEOUT_MS`: `@IsOptional()`, `@Transform(parseInt)`, `@IsInt()`, `@Min(1000)`, default `30_000`. Bounds DIAL Core file download, listing, delete and other file-operation requests as a whole-request timeout. For `POST /api/v1/files` it is instead the maximum time the transfer may go without moving data.

Both variables SHALL be documented in `apps/chat-api/README.md` and added as commented placeholders to `apps/chat-api/.env.template`.

#### Scenario: Default values applied when env vars absent
- **WHEN** neither variable is set in the environment
- **THEN** the application starts without error and uses the declared defaults

#### Scenario: Invalid value rejected at startup
- **WHEN** `FILE_UPLOAD_MAX_BYTES` is set to a non-numeric string
- **THEN** the application fails to start with a descriptive validation error

---

### Requirement: The BFF accepts slow request bodies up to the upload ceiling
The NestJS HTTP server SHALL set Node's `requestTimeout` to `UPLOAD_MAX_DURATION_MS` (30 minutes, exported from `apps/chat-api/src/files/upload/upload-watchdog.ts`) through `configureHttpServerTimeouts` (`apps/chat-api/src/common/utils/http-server-timeouts.ts`), called from `apps/chat-api/src/main.ts`, so that a request body which keeps arriving is not cut at Node's 5-minute default. `headersTimeout` SHALL keep Node's default.

#### Scenario: Slow upload longer than five minutes
- **WHEN** a browser sends a `POST /api/v1/files` body that keeps arriving for longer than 5 minutes and finishes within 30 minutes
- **THEN** the BFF receives the whole body and processes the upload instead of answering `408 Request Timeout`

#### Scenario: Server timeouts are configured
- **WHEN** `configureHttpServerTimeouts` is applied to an HTTP server
- **THEN** its `requestTimeout` equals `UPLOAD_MAX_DURATION_MS`
- **AND** its `headersTimeout` is unchanged

### Requirement: Stream a raw-body upload to DIAL Core without staging
The system SHALL expose `PUT /api/v1/files/content` (operationId `uploadFileContent` → generated SDK method `filesApi.uploadFileContent(...)`) that accepts the file as the raw request body and forwards it to DIAL Core `PUT /v1/files/{bucket}/{path}` under the authenticated user's session, returning `201 Created` with a `FileUploadResponseDto` (`apps/chat-api/src/files/dto/upload-file-response.dto.ts`) on success. Authorization is the same as `POST /api/v1/files`: any authenticated session (global session guard and CSRF guard); DIAL Core enforces bucket permissions.

The handler MUST NOT write the body to disk and MUST NOT buffer it in memory beyond stream buffers. It SHALL wrap the request stream in the same multipart envelope and pass it through the same raw-`fetch` upload helper (`uploadFileStream` in `apps/chat-api/src/files/upload/files-upload.service.ts`) that `POST /api/v1/files` uses, so that a slow DIAL Core connection pauses reading from the browser connection (backpressure) instead of accumulating data in the BFF.

- **Request content-type**: `application/octet-stream` only.
- **Request body**: the file bytes.
- **Query parameters** (validated by `UploadFileContentQueryDto` in `apps/chat-api/src/files/dto/upload-file-content.dto.ts`, which extends `UploadFileDto` from `apps/chat-api/src/files/dto/upload-file.dto.ts`, so `bucket`, `path` and `uploadMode` carry exactly the validation, percent-encoding rules and `uploadMode` → `If-None-Match` mapping of `POST /api/v1/files`):

| Parameter | Type | Validation |
|---|---|---|
| `bucket` | string | Required; same as `POST /api/v1/files` |
| `path` | string | Required; same as `POST /api/v1/files`; its last segment is the multipart `filename` sent to DIAL Core |
| `uploadMode` | `'overwrite' \| 'create-only'` | Optional; same as `POST /api/v1/files` |
| `contentType` | string | Optional; `@Matches` a `type/subtype` MIME allowlist pattern, up to 255 characters; the `Content-Type` of the file part sent to DIAL Core; defaults to `application/octet-stream` |

- **Swagger**: `@ApiConsumes('application/octet-stream')`, `@ApiBody({ schema: { type: 'string', format: 'binary' } })`, query DTO with `@ApiProperty` on every field, `@ApiResponse` for every status below.

**Example request**

```http
PUT /api/v1/files/content?bucket=Abc123&path=reports%2F2026%2Fq3.csv&uploadMode=create-only&contentType=text%2Fcsv
Content-Type: application/octet-stream
Content-Length: 419430400
X-CSRF-Token: <token>

<419430400 bytes>
```

**Example response (201)**

```json
{ "url": "files/Abc123/reports/2026/q3.csv" }
```

**Size and length.** The request SHALL carry `Content-Length`; a request without it (including `Transfer-Encoding: chunked`) SHALL be rejected with `411 Length Required`. A `Content-Length` greater than `FILE_UPLOAD_MAX_BYTES` SHALL be rejected with `413 Payload Too Large` and the message `File too large` before any body byte is forwarded to DIAL Core. The PUT to DIAL Core SHALL carry `Content-Length` equal to the multipart preamble length + the request `Content-Length` + the multipart epilogue length, and SHALL NOT use `Transfer-Encoding: chunked`. If the request body ends with a byte count different from its `Content-Length`, the DIAL Core request SHALL be aborted.

**Transfer limits.** The pass-through SHALL be bounded by the same `UploadWatchdog` limits as `POST /api/v1/files` (`apps/chat-api/src/files/upload/upload-watchdog.ts`): `FILE_TRANSFER_TIMEOUT_MS` without a chunk moving (a stall on either the browser or the DIAL Core side), 2 minutes for DIAL Core to answer after the last chunk, and a 30-minute ceiling; each abort returns `503 Service Unavailable` with the existing cause message.

**Client disconnect.** When the browser connection closes before the whole body has arrived, the BFF SHALL abort the DIAL Core request and SHALL NOT send a response.

**Error codes:** 400 (invalid query), 401, 403, 409 (`create-only` race, from DIAL Core 412), 411, 413 (own limit or DIAL Core 413), 415, 429, 502 (DIAL Core 5xx), 503 (unreachable / transfer limit), 500. DIAL Core statuses are mapped exactly as for `POST /api/v1/files`.

**Generated-client impact:** adds `filesApi.uploadFileContent({ bucket, path, uploadMode?, contentType?, body })`; no frontend code calls it — the file manager sends this request through the XHR transport (`createUploadFileWithProgress` with `UploadBodyEncoding.Raw`, see `chat-hooks-api-transport`) because the generated fetch client cannot report upload progress. `POST /api/v1/files` and its operation `uploadFile` are unchanged.

**Observability:** no new metrics; the request is covered by the existing HTTP lifecycle instrumentation and `MetricsInterceptor`. The service SHALL log the same debug/error lines as `uploadFile` (bucket, path, size, abort reason) and SHALL NOT log the body.

#### Scenario: Large file streams through without touching disk
- **WHEN** an authenticated user sends `PUT /api/v1/files/content` with a 400 MB body and a valid query
- **THEN** the BFF forwards the body to DIAL Core as it arrives and returns `201 Created` with `{ "url": "files/{bucket}/{path}" }`
- **AND** no file is created under `os.tmpdir()`

#### Scenario: Exact Content-Length is forwarded
- **WHEN** the request carries `Content-Length: N`
- **THEN** the PUT to DIAL Core carries `Content-Length` equal to the preamble length + N + the epilogue length and no `Transfer-Encoding: chunked`

#### Scenario: Declared size over the limit
- **WHEN** the request `Content-Length` exceeds `FILE_UPLOAD_MAX_BYTES`
- **THEN** the system returns `413 Payload Too Large` with the message `File too large`
- **AND** no request is sent to DIAL Core

#### Scenario: Missing Content-Length
- **WHEN** the request has no `Content-Length` header
- **THEN** the system returns `411 Length Required` and no request is sent to DIAL Core

#### Scenario: Wrong request content type
- **WHEN** the request `Content-Type` is not `application/octet-stream` (for example `application/json` or `multipart/form-data`)
- **THEN** the system returns `415 Unsupported Media Type` and no request is sent to DIAL Core

#### Scenario: Invalid query
- **WHEN** `bucket`, `path`, `uploadMode` or `contentType` fails validation, or an undeclared query parameter is present
- **THEN** `ValidationPipe` returns `400 Bad Request` and no request is sent to DIAL Core

#### Scenario: Create-only upload loses a race
- **WHEN** `uploadMode=create-only` and DIAL Core answers `412 Precondition Failed`
- **THEN** the system returns `409 Conflict` with body `{ "message": "File already exists at this path" }`

#### Scenario: Browser disconnects mid-body
- **WHEN** the browser connection closes after part of the body was forwarded
- **THEN** the DIAL Core request is aborted

#### Scenario: Transfer stalls
- **WHEN** no chunk moves through the pass-through for `FILE_TRANSFER_TIMEOUT_MS`
- **THEN** the DIAL Core request is aborted and the system returns `503 Service Unavailable` with a message stating the upload stalled

#### Scenario: DIAL Core rejects the size
- **WHEN** DIAL Core answers `413`
- **THEN** the system returns `413 Payload Too Large`

#### Scenario: Multipart endpoint is unaffected
- **WHEN** a client sends `POST /api/v1/files` with `multipart/form-data`
- **THEN** it behaves as specified in "Upload file to DIAL Core via BFF", including staging the part under `os.tmpdir()`
