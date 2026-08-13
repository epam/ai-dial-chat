# file-list Specification

## Purpose

Listing files for the file manager: normalizing DIAL metadata, supporting virtual folders, and paginating via `nextToken`.

## Requirements

### Requirement: List files for FileManager

The system SHALL expose `GET /api/v1/files/list` accepting `bucket` (required), `path` (optional, default `""`), `token` (optional), `limit` (optional), `recursive` (optional, default `false`), and `permissions` (optional, default `true`) query parameters, validate all inputs, and proxy the request to DIAL Core `GET /v1/metadata/files/{Bucket}/{Path}` under the authenticated user's session. The endpoint SHALL return `200 OK` with a `ListFilesResponseDto` on success.

The `GET /api/v1/files/list` endpoint scope is limited to the user's own bucket (or any explicitly specified bucket the user has access to via DIAL Core permissions). It is NOT used for shared-with-me or public/organization listings — those are served by the new `GET /api/v1/files/shared` and `GET /api/v1/files/public` endpoints defined in the `file-manager-shared-list` spec. No `source`, `tab`, or `sharedWithMe`/`publishedWithMe` query parameters are added to this endpoint.

- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })` (same as download; listing is read-only metadata).
- **HTTP method / route**: `GET /api/v1/files/list`
- **operationId**: `listFiles` → generated SDK method `filesApi.listFiles(...)`.
- **Request content-type**: none (query params only).
- **Response content-type**: `application/json`.

**Query parameters:**

| Parameter     | Type    | Required | Default |
|---------------|---------|----------|---------|
| `bucket`      | string  | yes      | —       |
| `path`        | string  | no       | `""`    |
| `token`       | string  | no       | —       |
| `limit`       | number  | no       | —       |
| `recursive`   | boolean | no       | `false` |
| `permissions` | boolean | no       | `true`  |

**Success response (200):** `ListFilesResponseDto`

```json
{
  "bucket": "user-bucket",
  "path": "folder/",
  "items": [
    {
      "name": "subfolder",
      "path": "folder/subfolder/",
      "folderId": "user-bucket:folder/subfolder/",
      "nodeType": "folder",
      "bucket": "user-bucket",
      "parentPath": "folder/",
      "url": "files/user-bucket/folder/subfolder/",
      "updatedAt": 1710000000000
    },
    {
      "name": "report.pdf",
      "path": "folder/report.pdf",
      "folderId": "user-bucket:folder/",
      "nodeType": "item",
      "bucket": "user-bucket",
      "parentPath": "folder/",
      "url": "files/user-bucket/folder/report.pdf",
      "contentLength": 12345,
      "contentType": "application/pdf",
      "updatedAt": 1710000000000,
      "permissions": ["READ", "WRITE"]
    }
  ],
  "nextToken": "opaque-pagination-cursor"
}
```

**Error codes:** 400, 401, 403, 404, 429, 502, 503, 500.

**Generated client:**
- `operationId`: `listFiles`
- Request DTO: `ListFilesQueryDto` (query params as described)
- Response DTO: `ListFilesResponseDto` with nested `ListFilesItemDto[]`
- Frontend callers use the normal `filesApi.listFiles(params)` method (not `Raw`); no generator gap applies.

**Feature flag:** Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. The endpoint is available to all authenticated users.

**Cache:** No cache at BFF or frontend layer.

**Observability / telemetry:** No new metrics or analytics events required for the endpoint itself. The existing `MetricsInterceptor` tracks request duration and error rate for all controllers.

**Accessibility / RTL impact:** Backend-only endpoint and frontend wrapper. No UI surface, no RTL concerns, no ARIA requirements.

**Memoisation:** No memoisation requirements for the frontend wrapper function.

---

#### Scenario: Root listing

- **GIVEN** an authenticated user
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket` is called (no `path` param)
- **THEN** the system calls DIAL Core `GET /v1/metadata/files/my-bucket/` with an empty path, returns `200 OK`, and `items` contains the root-level files and folders

---

#### Scenario: Nested folder listing

- **GIVEN** an authenticated user
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=reports/` is called
- **THEN** the system calls DIAL Core with `path = "reports/"`, returns `200 OK`, and `items` contains only the direct children of `reports/`

---

#### Scenario: Folder path without trailing slash

- **GIVEN** the caller sends `path=reports` (no trailing slash)
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=reports` is handled
- **THEN** the service normalizes the path to `reports/` before calling DIAL Core, and the response `path` field reflects the normalized value `"reports/"`

---

#### Scenario: Normalize DIAL uppercase nodeType

- **GIVEN** DIAL Core returns an item with `nodeType: "FOLDER"` (uppercase)
- **WHEN** the service normalizes the item
- **THEN** the response item contains `nodeType: "folder"` (lowercase), compatible with `DialFileNodeType.FOLDER`

---

#### Scenario: Bucket without physical folder objects (virtual folders)

- **GIVEN** a bucket whose storage has only object keys such as `reports/q1.pdf` and `reports/q2.pdf` but no physical object at `reports/`
- **WHEN** DIAL Core returns an item with `nodeType: "FOLDER"` for the `reports/` prefix
- **THEN** the response includes a folder item with `path: "reports/"`, `folderId: "my-bucket:reports/"`, `nodeType: "folder"`, and no `contentLength` or `contentType`

---

#### Scenario: Pagination token round-trip

- **GIVEN** a folder with more items than the requested `limit`
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=large-folder/&limit=20` returns a first page
- **THEN** the response `nextToken` is a non-empty opaque string
- **AND WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=large-folder/&limit=20&token=<nextToken>` is called
- **THEN** the response contains the next page of items

---

#### Scenario: Invalid traversal path

- **GIVEN** a caller sends `path=../../etc/passwd`
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=../../etc/passwd` is handled by `ValidationPipe`
- **THEN** the system returns `400 Bad Request` with a validation error identifying the `path` field, and the request does not reach DIAL Core

---

#### Scenario: Path with leading slash rejected

- **GIVEN** a caller sends `path=/folder`
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket&path=/folder` is validated
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

---

#### Scenario: Invalid bucket format

- **GIVEN** a caller sends `bucket=my/bucket` (contains a slash)
- **WHEN** `GET /api/v1/files/list?bucket=my/bucket` is validated by `ListFilesQueryDto`
- **THEN** the system returns `400 Bad Request` identifying the `bucket` field

---

#### Scenario: Unauthenticated request

- **GIVEN** a request carries no valid session cookie
- **WHEN** `GET /api/v1/files/list?bucket=my-bucket` is received
- **THEN** the session guard returns `401 Unauthorized` before the handler or DIAL Core is called

---

#### Scenario: DIAL Core returns 403

- **GIVEN** the authenticated user does not own or have access to the requested bucket
- **WHEN** DIAL Core returns `403 Forbidden`
- **THEN** `handleDialError` maps it to `ForbiddenException` and the BFF returns `403 Forbidden`

---

#### Scenario: DIAL Core returns 404

- **GIVEN** the requested `bucket` or `path` does not exist in DIAL Core
- **WHEN** DIAL Core returns `404 Not Found`
- **THEN** `handleDialError` maps it to `NotFoundException` and the BFF returns `404 Not Found`

---

#### Scenario: DIAL Core returns 429

- **GIVEN** DIAL Core is rate-limiting requests for the authenticated user
- **WHEN** DIAL Core returns `429 Too Many Requests`
- **THEN** `handleDialError` maps it to `TooManyRequestsException` and the BFF returns `429 Too Many Requests`

---

#### Scenario: DIAL Core returns 5xx

- **GIVEN** DIAL Core encounters an internal error
- **WHEN** DIAL Core returns a `5xx` status
- **THEN** the service logs the error and `handleDialError` maps it to `BadGatewayException`; the BFF returns `502 Bad Gateway`

---

#### Scenario: DIAL Core request times out

- **GIVEN** the DIAL Core metadata endpoint is slow or unreachable
- **WHEN** the `AbortSignal.timeout(FILE_TRANSFER_TIMEOUT_MS)` fires
- **THEN** `handleDialError` maps the abort error to `ServiceUnavailableException`; the BFF returns `503 Service Unavailable`

---

#### Scenario: limit out of range

- **GIVEN** a caller sends `limit=0` or `limit=9999`
- **WHEN** `ValidationPipe` processes `ListFilesQueryDto`
- **THEN** the system returns `400 Bad Request` identifying the `limit` field; DIAL Core is not called

---

#### Scenario: Endpoint is NOT used for shared or organization listing

- **WHEN** the frontend needs to list files shared with the user
- **THEN** it calls `GET /api/v1/files/shared` (not `GET /api/v1/files/list` with any special parameter)

---

### Requirement: Normalize DIAL metadata to FileManager-compatible nodes

The system SHALL map each item in the DIAL Core folder response to a `ListFilesItemDto` whose JSON shape is structurally compatible with the `DialFile` interface from `@epam/ai-dial-ui-kit`. The backend SHALL NOT import `@epam/ai-dial-ui-kit`; compatibility is achieved through matching the JSON field names and types.

**Normalization rules:**
- `nodeType` → lowercase (`"ITEM"` → `"item"`, `"FOLDER"` → `"folder"`).
- `path` for folders → ensure trailing `/`.
- `folderId` for folders → `${bucket}:${normalizedPath}`.
- `folderId` for files → `${bucket}:${parentPath ?? ""}`.
- `contentLength` and `contentType` → omitted (undefined) for folder items.
- `contentType` for file items → `item.contentType` when DIAL Core supplies it; otherwise SHALL be inferred from the file name's extension via `mime-types`' `lookup()`, falling back to `undefined` when the extension is unknown or absent. This fallback exists because the sharing SDK response consumed by `file-manager-shared-list` does not include `contentType`/`contentLength` per item, unlike the regular metadata endpoint used here.
- `updatedAt` → forwarded as `number` (Unix ms) from DIAL; note that `DialModifiedEntity.updatedAt` is typed as `string` in the ui-kit — callers must cast if using the TypeScript type directly.
- `bucket` → propagated from the request query parameter (DIAL items may not include it).

#### Scenario: contentType is inferred from extension when DIAL Core omits it

- **GIVEN** a file item has no `contentType` from the upstream response and its name is `photo.png`
- **WHEN** `normalizeFileItem` maps the item
- **THEN** the resulting `contentType` is `"image/png"`

#### Scenario: contentType stays undefined for an unrecognized extension

- **GIVEN** a file item has no `contentType` from the upstream response and its name is `README` (no extension)
- **WHEN** `normalizeFileItem` maps the item
- **THEN** the resulting `contentType` is `undefined`

---

### Requirement: Support virtual folders without physical folder objects

The system SHALL correctly list folder items returned by DIAL Core even when the underlying storage has no physical object at the folder path. A DIAL item with `nodeType` resolving to `"folder"` SHALL be treated as a valid virtual folder entry and normalized accordingly. No additional existence check SHALL be made.

---

### Requirement: Pagination via nextToken

The system SHALL forward the `token` query parameter to DIAL Core as the continuation token and SHALL include the `nextToken` field from the DIAL Core response in `ListFilesResponseDto.nextToken`. When no further pages are available, `nextToken` SHALL be absent (undefined / omitted) from the response.

The `nextToken` field is not declared in the SDK TypeScript interface but is returned by the DIAL endpoint per its documented API contract. The service accesses it via a type cast.

---

### Requirement: DTO validation for list-files endpoint

The system SHALL parse and validate all query parameters through `ListFilesQueryDto` decorated with `class-validator` and `@ApiProperty` / `@ApiQuery`. The global `ValidationPipe` (whitelist + forbidNonWhitelisted) MUST reject undeclared parameters.

`ListFilesQueryDto` SHALL be defined at `apps/chat-api/src/files/dto/list-files.dto.ts`.

Field specifications:

- `bucket`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.-]+$/)`, `@MaxLength(256)`, `@ApiProperty(...)`
- `path`: `@IsOptional()`, `@IsString()`, `@Matches(/^[\w.\-/]*$/)`, custom `@IsValidFilePath()` validator (no leading `/`, no `..`), `@MaxLength(1024)`, `@ApiPropertyOptional(...)`
- `token`: `@IsOptional()`, `@IsString()`, `@MaxLength(1024)`, `@ApiPropertyOptional(...)`
- `limit`: `@IsOptional()`, `@Transform(({ value }) => parseInt(value, 10))`, `@IsInt()`, `@Min(1)`, `@Max(1000)`, `@ApiPropertyOptional(...)`
- `recursive`: `@IsOptional()`, `@Transform(({ value }) => value === 'true' || value === true)`, `@IsBoolean()`, `@ApiPropertyOptional(...)`
- `permissions`: `@IsOptional()`, `@Transform(({ value }) => value !== 'false' && value !== false)`, `@IsBoolean()`, `@ApiPropertyOptional(...)`

Response DTOs for Swagger (`ListFilesItemDto`, `ListFilesResponseDto`) SHALL be defined in the same file and carry full `@ApiProperty` annotations so the generated client has strong types.

---

### Requirement: Generated client and frontend wrapper

The system SHALL provide a typed frontend wrapper `listFiles(params)` in `apps/chat/src/server-api/files.api.ts` that delegates to the generated `filesApi.listFiles(...)` from `@epam/chat-api-client`.

The `filesApi` singleton is already exported from `apps/chat/src/server-api/api-client.ts`; no new singleton is needed.

- **operationId**: `listFiles`
- **SDK method**: `filesApi.listFiles({ bucket, path?, token?, limit?, recursive?, permissions? }): Promise<ListFilesResponseDto>`
- **Generator gap**: None expected; `application/json` response with typed DTO generates a strong return type.
- **Cache TTL**: No cache at the frontend layer.

#### Scenario: Frontend wrapper delegates to generated client

- **WHEN** `listFiles({ bucket: 'my-bucket', path: 'folder/' })` is called in `files.api.ts`
- **THEN** the function calls `filesApi.listFiles(...)` and resolves to a `ListFilesResponseDto` with the correct items

#### Scenario: Frontend wrapper propagates 401 error

- **WHEN** the session has expired and the server returns `401`
- **THEN** the `filesApi.listFiles(...)` call rejects with a response error, and the caller can catch and redirect to login
