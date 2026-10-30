## ADDED Requirements

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
