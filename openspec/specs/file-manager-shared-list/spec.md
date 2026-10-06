# file-manager-shared-list Specification

## Purpose

Endpoints listing files shared with the current user and files in the organization bucket.

## Requirements

### Requirement: GET /api/v1/files/shared lists files shared with the current user

The system SHALL expose `GET /api/v1/files/shared` in `apps/chat-api/src/files/files.controller.ts`. The endpoint proxies the DIAL Core sharing API to return files shared with the authenticated user.

- **HTTP method / route**: `GET /api/v1/files/shared`
- **operationId**: `listSharedFiles` → generated SDK method `filesApi.listSharedFiles(...)`
- **Auth**: session cookie; BFF forwards the bearer token to DIAL Core
- **Request content-type**: none (query params only)
- **Response content-type**: `application/json`

Query parameters are validated by `ListSharedFilesQueryDto` (`path`: `@IsValidFilePath`, max 1024; `token`: max 1024; `limit`: integer 1-1000).

**Query parameters:**

| Parameter | Type   | Required | Default |
|-----------|--------|----------|---------|
| `path`    | string | no       | `""`    |
| `token`   | string | no       | —       |
| `limit`   | number | no       | —       |

**Success response (200):** `ListFilesResponseDto` (same DTO shape as `GET /api/v1/files/list`)

The service (`FilesListingService.listSharedFiles` in `apps/chat-api/src/files/listing/files-listing.service.ts`) SHALL call the DIAL Core sharing SDK method `getSharedResources` with `{ resourceTypes: ['FILE'], with: 'me', includeUserInfo: true }`, drop reserved root folders, and map results to `ListFilesItemDto[]` using the existing `normalizeFileItem` utility. Filtering and paging happen in the BFF: `path` keeps only items whose path equals or starts with it, `limit` truncates the result, and `token` is accepted but not used (no `nextToken` is returned). The response carries `bucket: ''` and `path` set to the requested path (or `''`). No `sharedWithMe` flag is added to the DTO — the endpoint itself guarantees all items are shared.

The sharing SDK response does not include `contentType`/`contentLength` per item (unlike the regular metadata endpoint used by `GET /api/v1/files/list`). `normalizeFileItem` compensates by inferring `contentType` from the file name's extension (see `file-list`'s "Normalize DIAL metadata to FileManager-compatible nodes" requirement) so that MIME-type-based attach restrictions (`dial-file-manager-attach-validation`) apply consistently to shared files, not only to `my_files`/`organization` files.

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
- **THEN** `handleDialSdkError` maps a DIAL Core 5xx to `502 Bad Gateway` (an unreachable or timed-out DIAL Core maps to `503`)

#### Scenario: Frontend wrapper delegates to generated client

- **WHEN** `listSharedFiles({})` is called in `files.api.ts`
- **THEN** the function (built by `createFilesApiClient` from `@epam/ai-dial-chat-hooks`) calls `filesApi.listSharedFiles(...)` and resolves to `ListFilesResponseDto`

---

### Requirement: GET /api/v1/files/public lists files from the organization (public) bucket

The system SHALL expose `GET /api/v1/files/public` in `apps/chat-api/src/files/files.controller.ts`. The endpoint lists files from the fixed public bucket (`PUBLIC_BUCKET = 'public'`) using the existing single-bucket listing infrastructure.

- **HTTP method / route**: `GET /api/v1/files/public`
- **operationId**: `listPublicFiles` → generated SDK method `filesApi.listPublicFiles(...)`
- **Auth**: session cookie
- **Request content-type**: none (query params only)
- **Response content-type**: `application/json`

Query parameters are validated by `ListPublicFilesQueryDto` (`path`: `@IsValidFilePath`, max 1024; `token`: max 1024; `limit`: integer 1-1000; `recursive`: boolean).

**Query parameters:**

| Parameter     | Type    | Required | Default |
|---------------|---------|----------|---------|
| `path`        | string  | no       | `""`    |
| `token`       | string  | no       | —       |
| `limit`       | number  | no       | —       |
| `recursive`   | boolean | no       | `false` |

`permissions` is always `false` for the public bucket (users cannot write; permission info is irrelevant and omitted from the response).

**Success response (200):** `ListFilesResponseDto`

The service (`FilesListingService.listPublicFiles`) SHALL delegate to the same service `listFiles` used by `GET /api/v1/files/list`, with bucket `'public'` (the value of `PUBLIC_BUCKET` in `apps/chat-api/src/constants/dial.constants.ts`), the provided `path`, and `permissions: false`. Items are normalized using `normalizeFileItem`.

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
- **THEN** the function (built by `createFilesApiClient` from `@epam/ai-dial-chat-hooks`) calls `filesApi.listPublicFiles(...)` and resolves to `ListFilesResponseDto`

---

### Requirement: Frontend wrappers for shared and public file listing

The system SHALL provide typed frontend wrappers `listSharedFiles(params)` and `listPublicFiles(params)` in `apps/chat/src/server-api/files.api.ts`, delegating to the generated `filesApi.listSharedFiles(...)` and `filesApi.listPublicFiles(...)` from `@epam/ai-dial-chat-api-client`. Both wrappers SHALL follow the same pattern as the existing `listFiles` wrapper: `files.api.ts` re-exports them from `createFilesApiClient(filesApi, uploadFileWithProgress)` (`@epam/ai-dial-chat-hooks`).

#### Scenario: listSharedFiles resolves to typed response

- **WHEN** `listSharedFiles({})` is called
- **THEN** the result is typed as `ListFilesResponseDto` with no TypeScript errors

#### Scenario: listPublicFiles resolves to typed response

- **WHEN** `listPublicFiles({ path: 'folder/' })` is called
- **THEN** the result is typed as `ListFilesResponseDto` with no TypeScript errors
