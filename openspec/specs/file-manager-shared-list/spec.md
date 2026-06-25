## ADDED Requirements

### Requirement: GET /api/v1/files/shared lists files shared with the current user

The system SHALL expose `GET /api/v1/files/shared` in `apps/chat-api/src/files/files.controller.ts`. The endpoint proxies the DIAL Core sharing API to return files shared with the authenticated user.

- **HTTP method / route**: `GET /api/v1/files/shared`
- **operationId**: `listSharedFiles` → generated SDK method `filesApi.listSharedFiles(...)`
- **Auth**: session cookie; BFF forwards the bearer token to DIAL Core
- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- **Request content-type**: none (query params only)
- **Response content-type**: `application/json`

**Query parameters:**

| Parameter | Type   | Required | Default |
|-----------|--------|----------|---------|
| `path`    | string | no       | `""`    |
| `token`   | string | no       | —       |
| `limit`   | number | no       | —       |

**Success response (200):** `ListFilesResponseDto` (same DTO shape as `GET /api/v1/files/list`)

The service SHALL call the DIAL Core sharing SDK method for files (`resourceTypes: ['FILE']`) and map results to `ListFilesItemDto[]` using the existing `normalizeFileItem` utility. No `sharedWithMe` flag is added to the DTO — the endpoint itself guarantees all items are shared.

**Error codes:** 400, 401, 429, 502, 503, 500.

**Feature flag:** None. Available to all authenticated users.

**Cache:** No cache at BFF or frontend layer.

#### Scenario: Returns files shared with the current user

- **GIVEN** the current user has files shared with them by another user
- **WHEN** `GET /api/v1/files/shared` is called with a valid session
- **THEN** the response is `200 OK` with `items` containing the shared file entries and correct `ListFilesItemDto` shape

#### Scenario: Empty result when no files are shared

- **GIVEN** no files are shared with the current user
- **WHEN** `GET /api/v1/files/shared` is called
- **THEN** the response is `200 OK` with `items: []`

#### Scenario: Unauthenticated request returns 401

- **GIVEN** no valid session cookie
- **WHEN** `GET /api/v1/files/shared` is called
- **THEN** the session guard returns `401 Unauthorized` before reaching the handler

#### Scenario: DIAL Core sharing API returns 502

- **GIVEN** DIAL Core is unreachable or returns a 5xx error
- **WHEN** `GET /api/v1/files/shared` is called
- **THEN** `handleDialError` maps the error to `502 Bad Gateway`

#### Scenario: Frontend wrapper delegates to generated client

- **WHEN** `listSharedFiles({})` is called in `files.api.ts`
- **THEN** the function calls `filesApi.listSharedFiles(...)` and resolves to `ListFilesResponseDto`

---

### Requirement: GET /api/v1/files/public lists files from the organization (public) bucket

The system SHALL expose `GET /api/v1/files/public` in `apps/chat-api/src/files/files.controller.ts`. The endpoint lists files from the fixed public bucket (`PUBLIC_BUCKET = 'public'`) using the existing single-bucket listing infrastructure.

- **HTTP method / route**: `GET /api/v1/files/public`
- **operationId**: `listPublicFiles` → generated SDK method `filesApi.listPublicFiles(...)`
- **Auth**: session cookie
- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- **Request content-type**: none (query params only)
- **Response content-type**: `application/json`

**Query parameters:**

| Parameter     | Type    | Required | Default |
|---------------|---------|----------|---------|
| `path`        | string  | no       | `""`    |
| `token`       | string  | no       | —       |
| `limit`       | number  | no       | —       |
| `recursive`   | boolean | no       | `false` |

`permissions` is always `false` for the public bucket (users cannot write; permission info is irrelevant and omitted from the response).

**Success response (200):** `ListFilesResponseDto`

The service SHALL call the existing `listFiles` SDK method with `bucket = PUBLIC_BUCKET` and the provided `path`. Items are normalized using `normalizeFileItem`.

**Error codes:** 400, 401, 404, 429, 502, 503, 500.

**Feature flag:** None.

**Cache:** No cache.

#### Scenario: Lists files from the public bucket

- **GIVEN** the public bucket contains files
- **WHEN** `GET /api/v1/files/public` is called
- **THEN** the response is `200 OK` with items from the `public` bucket

#### Scenario: Subfolder listing in public bucket

- **WHEN** `GET /api/v1/files/public?path=reports/` is called
- **THEN** the service lists `reports/` under the `public` bucket and returns matching items

#### Scenario: Public bucket empty returns empty list

- **GIVEN** the public bucket has no files
- **WHEN** `GET /api/v1/files/public` is called
- **THEN** the response is `200 OK` with `items: []`

#### Scenario: Unauthenticated request returns 401

- **GIVEN** no valid session cookie
- **WHEN** `GET /api/v1/files/public` is called
- **THEN** the response is `401 Unauthorized`

#### Scenario: Frontend wrapper delegates to generated client

- **WHEN** `listPublicFiles({})` is called in `files.api.ts`
- **THEN** the function calls `filesApi.listPublicFiles(...)` and resolves to `ListFilesResponseDto`

---

### Requirement: Frontend wrappers for shared and public file listing

The system SHALL provide typed frontend wrappers `listSharedFiles(params)` and `listPublicFiles(params)` in `apps/chat/src/server-api/files.api.ts`, delegating to the generated `filesApi.listSharedFiles(...)` and `filesApi.listPublicFiles(...)` from `@epam/chat-api-client`. Both wrappers SHALL follow the same pattern as the existing `listFiles` wrapper.

#### Scenario: listSharedFiles resolves to typed response

- **WHEN** `listSharedFiles({})` is called
- **THEN** the result is typed as `ListFilesResponseDto` with no TypeScript errors

#### Scenario: listPublicFiles resolves to typed response

- **WHEN** `listPublicFiles({ path: 'folder/' })` is called
- **THEN** the result is typed as `ListFilesResponseDto` with no TypeScript errors
