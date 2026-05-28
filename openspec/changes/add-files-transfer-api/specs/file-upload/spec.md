## ADDED Requirements

### Requirement: Upload file to DIAL Core via BFF
The system SHALL expose `POST /api/v1/files` accepting a `multipart/form-data` request with a `file` field (binary) and `bucket` + `path` form fields, validate all inputs, and proxy the upload to DIAL Core `POST /v1/files/{bucket}/{path}` under the authenticated user's session. The endpoint SHALL return `201 Created` with a `FileUploadResponseDto` on success.

The handler MUST NOT store the file on disk; it SHALL stream the in-memory buffer to DIAL Core immediately. The multer `memoryStorage` engine MUST be used with `limits.fileSize` drawn from the `FILE_UPLOAD_MAX_BYTES` environment variable (default 50 MB).

- **Rate limit**: `@Throttle({ default: { limit: 20, ttl: 60000 } })` (stricter than global 100/min).
- **Swagger**: `@ApiConsumes('multipart/form-data')` and `@ApiBody` with schema describing `file`, `bucket`, and `path` fields.
- **operationId**: `uploadFile` → generated SDK method `filesApi.uploadFile(...)`.
- **Request content-type**: `multipart/form-data`
- **Response content-type**: `application/json`

**Request form fields:**
| Field    | Type   | Validation |
|----------|--------|------------|
| `file`   | binary | Required; max size enforced by multer |
| `bucket` | string | Required; `@Matches(/^[\w.\-]+$/)` — no slashes, no colons |
| `path`   | string | Required; `@Matches(/^[\w.\-/]+$/)` — allows path segments; must not start with `/`; must not contain `..` |

**Success response (201):** `FileUploadResponseDto`
```
{ url: string }   // DIAL Core-returned URL for the uploaded file
```

**Error codes:** 400, 401, 403, 413, 429, 502, 503, 500.

#### Scenario: Successful file upload
- **WHEN** an authenticated user sends a valid `multipart/form-data` POST with a file, a valid bucket, and a valid path
- **THEN** the system proxies the file to DIAL Core, returns `201 Created`, and the response body contains the uploaded file's URL

#### Scenario: Unauthenticated upload attempt
- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before forwarding anything to DIAL Core

#### Scenario: Invalid bucket format
- **WHEN** the `bucket` field contains a slash, colon, or other character outside `[\w.\-]`
- **THEN** the system returns `400 Bad Request` with a validation error message and does not forward the request to DIAL Core

#### Scenario: Invalid path — traversal attempt
- **WHEN** the `path` field contains `..` or URL-encoded equivalents such as `%2E%2E`
- **THEN** the system returns `400 Bad Request` and does not forward the request to DIAL Core

#### Scenario: File exceeds size limit
- **WHEN** the uploaded file exceeds `FILE_UPLOAD_MAX_BYTES`
- **THEN** multer rejects the request and the system returns `413 Payload Too Large`

#### Scenario: DIAL Core returns 403
- **WHEN** DIAL Core responds with `403 Forbidden` (user lacks permission for the bucket)
- **THEN** the system returns `403 Forbidden` to the browser

#### Scenario: DIAL Core returns 429
- **WHEN** DIAL Core rate-limits the request
- **THEN** the system returns `429 Too Many Requests` to the browser

#### Scenario: DIAL Core is unreachable
- **WHEN** the fetch to DIAL Core times out or the connection is refused
- **THEN** the system returns `503 Service Unavailable`

#### Scenario: DIAL Core returns unexpected 5xx
- **WHEN** DIAL Core returns a 5xx status code
- **THEN** the system logs the error and returns `502 Bad Gateway`

---

### Requirement: Upload DTO validation
The system SHALL parse and validate the `bucket` and `path` form fields through a `UploadFileDto` class decorated with `class-validator` and `@ApiProperty`. The global `ValidationPipe` (whitelist + forbidNonWhitelisted) MUST reject any undeclared fields and strip them before the handler runs.

The `UploadFileDto` SHALL be defined at `apps/chat-api/src/files/dto/upload-file.dto.ts`.

- `bucket`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.\-]+$/)`, `@MaxLength(256)`
- `path`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.\-/]+$/)`, `@MaxLength(1024)`, and a custom validator or transform that rejects values starting with `/` or containing `..`

#### Scenario: Valid DTO passes validation
- **WHEN** `bucket` is `my-bucket` and `path` is `folder/file.txt`
- **THEN** the DTO instantiates successfully and the handler receives the validated object

#### Scenario: Empty bucket rejected
- **WHEN** `bucket` is an empty string
- **THEN** `ValidationPipe` returns `400 Bad Request` with an error message identifying the `bucket` field

#### Scenario: Extra fields stripped
- **WHEN** the form body includes an undeclared field such as `admin: true`
- **THEN** the field is absent from the validated DTO and does not reach the service layer

---

### Requirement: Upload environment configuration
The system SHALL add `FILE_UPLOAD_MAX_BYTES` and `FILE_TRANSFER_TIMEOUT_MS` to `EnvironmentVariables` with sensible defaults and class-validator decorators.

- `FILE_UPLOAD_MAX_BYTES`: `@IsOptional()`, `@Transform(parseInt)`, `@IsInt()`, `@Min(1)`, default `52_428_800` (50 MB).
- `FILE_TRANSFER_TIMEOUT_MS`: `@IsOptional()`, `@Transform(parseInt)`, `@IsInt()`, `@Min(1000)`, default `30_000`.

Both variables SHALL be documented in `apps/chat-api/README.md` and added as placeholders to `.env.example`.

#### Scenario: Default values applied when env vars absent
- **WHEN** neither variable is set in the environment
- **THEN** the application starts without error and uses the declared defaults

#### Scenario: Invalid value rejected at startup
- **WHEN** `FILE_UPLOAD_MAX_BYTES` is set to a non-numeric string
- **THEN** the application fails to start with a descriptive validation error
