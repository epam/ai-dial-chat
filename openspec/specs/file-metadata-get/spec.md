# file-metadata-get Specification

## Purpose

Retrieving single-file metadata through the Chat API.

## Requirements

### Requirement: Retrieve single-file metadata through Chat API

The system SHALL expose `GET /api/v1/files/metadata` accepting `bucket` (required)
and `path` (required, non-empty, no trailing `/`) as query parameters, validate
all inputs, and proxy the request to DIAL Core
`GET /v1/metadata/files/{Bucket}/{Path}` under the authenticated user's session,
passing the path **without** appending `/`. The endpoint SHALL return `200 OK`
with a `FileMetadataResponseDto` on success.

DIAL Core HTTP status mapping SHALL be based on the SDK response status whenever
the SDK provides a response object. A response-level `404` from DIAL Core,
including an empty 404 response body where the SDK result has `data: undefined`,
`error: undefined`, and `response.status === 404`, SHALL be returned to the
caller as `404 Not Found`; it SHALL NOT be treated as a network failure or
mapped to `503 Service Unavailable`. `503` is reserved for cases where no
upstream HTTP status was received because DIAL Core was unreachable or the
request timed out.

**HTTP method / route**: `GET /api/v1/files/metadata`

**operationId**: `getFileMetadata` → generated SDK method `filesApi.getFileMetadata(…)`

**Authorization**: session-authenticated users only (`req.user.at` bearer token
forwarded to DIAL Core). Unauthenticated requests yield `401 Unauthorized`
(handled by the existing session guard).

**Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })` — same as
`listFiles` and `downloadFile`.

**Caching**: none. File metadata changes on every write; no cache TTL or
invalidation strategy is needed for this endpoint.

**Feature flag**: not gated — available to all authenticated users.

**i18n**: no new user-visible strings.

**RTL / accessibility impact**: none (server-side API only).

**Observability**: no new metrics required beyond the existing `MetricsInterceptor`
request-count and latency tracking applied globally.

---

**Query parameters:**

| Parameter | Type   | Required | Validation                                                        |
|-----------|--------|----------|-------------------------------------------------------------------|
| `bucket`  | string | yes      | `@Matches(/^[\w.-]+$/)`, `@MaxLength(256)`                        |
| `path`    | string | yes      | `@IsNotEmpty()`, `@IsValidFilePath()`, `@Matches` no trailing `/`, `@MaxLength(1024)` |

---

**Example request:**

```
GET /api/v1/files/metadata?bucket=user-bucket&path=reports/q1-2024.pdf
Authorization: (session cookie)
```

**Success response (200) — `FileMetadataResponseDto`:**

```json
{
  "name": "q1-2024.pdf",
  "nodeType": "item",
  "bucket": "user-bucket",
  "parentPath": "reports/",
  "url": "files/user-bucket/reports/q1-2024.pdf",
  "resourceType": "file",
  "etag": "\"abc123\"",
  "contentLength": 204800,
  "contentType": "application/pdf",
  "createdAt": 1710000000000,
  "updatedAt": 1712345678000,
  "permissions": ["READ", "WRITE"]
}
```

**Response DTO fields** (all `@ApiPropertyOptional` except where noted):

| Field           | Type              | Notes                              |
|-----------------|-------------------|------------------------------------|
| `name`          | string (optional) | File name without path             |
| `nodeType`      | string (optional) | Expected `"item"` for files        |
| `bucket`        | string (optional) |                                    |
| `parentPath`    | string (optional) |                                    |
| `url`           | string (optional) | DIAL Core resource URL             |
| `resourceType`  | string (optional) |                                    |
| `etag`          | string (optional) | Not available for folders          |
| `contentLength` | number (optional) |                                    |
| `contentType`   | string (optional) |                                    |
| `createdAt`     | number (optional) | Unix ms; not supported by all providers |
| `updatedAt`     | number (optional) | Unix ms                            |
| `permissions`   | string[] (optional) | `["READ" \| "WRITE" \| "SHARE"]` |
| `author`        | string (optional) | Not available for folders          |

---

**Error responses:**

| Status | Condition                                                       |
|--------|-----------------------------------------------------------------|
| 400    | Missing/empty `bucket` or `path`; `path` contains `..`, starts with `/`, has trailing `/`, or has forbidden characters |
| 401    | No valid session                                                |
| 403    | DIAL Core returns 403 (user lacks READ permission on file)      |
| 404    | DIAL Core returns 404, including an empty 404 response body (file does not exist) |
| 429    | Rate limit exceeded                                             |
| 502    | DIAL Core returns a non-OK, non-mapped HTTP status (4xx other than above, or 5xx) |
| 503    | No HTTP response from DIAL Core: unreachable, connection failure, or timeout |

---

#### Scenario: Happy path — existing file with known metadata

- **WHEN** an authenticated user sends `GET /api/v1/files/metadata?bucket=b&path=dir/file.txt`
- **THEN** the server calls `client.getFileMetadata("b", "dir/file.txt", …)` (no trailing `/`)
- **AND** returns `200 OK` with `FileMetadataResponseDto` containing at minimum `name` and `nodeType`

#### Scenario: Path is passed without trailing slash

- **WHEN** a request is made with `path=folder/file.pdf`
- **THEN** DIAL Core receives `path = "folder/file.pdf"` — no trailing `/` is appended
- **AND** the response contains scalar file fields (`etag`, `contentLength`) rather than `items[]`

#### Scenario: Path with trailing slash is rejected

- **WHEN** a request is sent with `path=folder/` (trailing slash)
- **THEN** the server returns `400 Bad Request` before calling DIAL Core

#### Scenario: Empty path is rejected

- **WHEN** a request is sent with `path=` (empty string) or `path` is absent
- **THEN** the server returns `400 Bad Request`

#### Scenario: Path traversal is rejected

- **WHEN** a request is sent with `path=../../etc/passwd`
- **THEN** the server returns `400 Bad Request` (caught by `IsValidFilePath`)

#### Scenario: Missing file maps DIAL Core 404 to Not Found

- **WHEN** an authenticated request with a syntactically valid `bucket` and `path=does-not-exist.pdf` reaches DIAL Core
- **AND** DIAL Core responds with HTTP 404, including an empty response body where the SDK result has `response.status === 404`
- **THEN** the server returns `404 Not Found`
- **AND** the response is not `503 Service Unavailable` with `"DIAL Core is unreachable"`

#### Scenario: DIAL Core returns 403

- **WHEN** the user does not have READ permission on the file
- **THEN** the server returns `403 Forbidden`

#### Scenario: DIAL Core returns 429

- **WHEN** DIAL Core responds with status 429
- **THEN** the server returns `429 Too Many Requests`

#### Scenario: DIAL Core returns 5xx

- **WHEN** DIAL Core responds with a 5xx status
- **THEN** the server returns `502 Bad Gateway`

#### Scenario: Network failure / timeout reaching DIAL Core

- **WHEN** the DIAL Core connection times out or is refused
- **THEN** the server returns `503 Service Unavailable`

#### Scenario: Unauthenticated request

- **WHEN** a request arrives without a valid session
- **THEN** the server returns `401 Unauthorized`

#### Scenario: Frontend wrapper returns typed FileMetadataResponseDto

- **WHEN** `getFileMetadata({ bucket, path })` is called in `apps/chat/src/server-api/files.api.ts`
- **THEN** it delegates to `filesApi.getFileMetadata({ bucket, path })` (generated client)
- **AND** returns a `Promise<FileMetadataResponseDto>`

#### Scenario: Existing listFiles behavior is unchanged

- **WHEN** `GET /api/v1/files/list?bucket=b&path=folder` is called
- **THEN** the service appends `/` making it `folder/` and proxies to DIAL Core as before
- **AND** the response is `ListFilesResponseDto` with an `items` array (no change in behavior)
