## Context

`FilesService.listFiles` (apps/chat-api/src/files/files.service.ts:78-118) calls
the DIAL SDK's `getFileMetadata(bucket, path, …)` but always normalises the path
to end with `/` before the call. DIAL Core treats a path ending in `/` as a
folder and returns an `items[]` array; a path without a trailing `/` targets a
single file and returns scalar file fields (`etag`, `contentLength`,
`contentType`, etc.). There is currently no Chat API endpoint that forwards a
bare file path.

The DIAL SDK method signature is already correct:
`client.getFileMetadata(bucket, path, init)` — the only difference is whether
`path` ends with `/`.

## Goals / Non-Goals

**Goals:**
- Expose `GET /api/v1/files/metadata` that passes the path to DIAL Core as-is
  (no trailing `/`), returning scalar file metadata.
- Reuse all existing patterns: `FilesController`, `FilesService` + `AppService`
  SDK client, `handleDialError`, DTO validation with `IsValidFilePath` + allowlist
  `@Matches`, Swagger annotations, `@Throttle`.
- Keep `GET /api/v1/files/list` unchanged in contract and implementation.
- Regenerate `@epam/chat-api-client` so the frontend gets a typed generated method.

**Non-Goals:**
- Folder metadata via this endpoint (callers wanting folder listings continue to
  use `GET /api/v1/files/list`).
- Caching — file metadata changes on every write and permission update; caching
  would need an invalidation bus that is out of scope.
- Any UI surface, new user-visible strings, i18n, or RTL changes.

## Decisions

### 1. New handler in `FilesController`, not a modified `listFiles`

**Chosen**: separate `@Get('metadata')` handler with its own DTO and service method.

**Why not modify `listFiles`**: adding a query-parameter switch (e.g.
`?fileMode=true`) would silently break callers that omit it, change the response
shape on an existing route, and mix two semantically different DIAL Core
operations under one endpoint. A separate route has an independent versioning
lifecycle and is trivially rollback-safe.

### 2. Reuse `client.getFileMetadata` from `AppService`, pass path without mutation

**Chosen**: `FilesService.getFileMetadata` calls
`this.client.getFileMetadata(bucket, path, …)` with the path exactly as received
from the validated DTO — no slash normalisation.

**Why not a separate SDK method or raw fetch**: the SDK already supports
single-file paths; the only change needed is omitting the normalisation step that
`listFiles` applies. Raw `fetch` would skip SDK typing and error normalisation
without benefit (see AGENTS.md §4).

### 3. Dedicated `FileMetadataResponseDto` (not `ListFilesItemDto`)

**Chosen**: new `FileMetadataResponseDto` in `apps/chat-api/src/files/dto/file-metadata.dto.ts`.

**Why not reuse `ListFilesItemDto`**: `ListFilesItemDto` was designed for list
rows (has a `folderId` field, missing `etag` and `createdAt`). The DIAL Core
single-file response has `etag` and `createdAt` which are explicitly "not
available for folders". A dedicated DTO keeps the generated client types clean
and avoids exposing `items[]` (a folder-only field) in a file-metadata response.

### 4. `GetFileMetadataQueryDto` requires non-empty `path`; forbids trailing `/`

**Chosen**: `@IsNotEmpty()` + `@IsValidFilePath()` + an explicit `@Matches` that
rejects a trailing `/`.

**Why**: if a caller accidentally passes a folder path, DIAL Core would return
`items[]` instead of scalar file fields. The validator rejects it at the Chat API
layer, returning a clear `400 Bad Request` before the upstream call is made.

### 5. Rate limit: 60 req / 60 s (same as `listFiles` and `downloadFile`)

**Rationale**: metadata reads are cheap, unauthenticated access is blocked by the
session guard, and the existing 60 req/min limit is well-established for
read-only file endpoints in this controller.

## Risks / Trade-offs

- **DIAL Core path ambiguity** — DIAL Core documentation does not explicitly
  forbid passing a file path to `getFileMetadata` with optional pagination params
  (`limit`, `recursive`). The implementation omits those params (they are only
  meaningful for folder listings). If a future DIAL Core version changes the
  single-file response shape, the `FileMetadataResponseDto` fields may need
  updating. *Mitigation*: keep the DTO fields `@ApiPropertyOptional` where DIAL
  Core marks them as optional.

- **`items` leakage** — the SDK 200 response type includes an optional `items`
  field (used for folder responses). If a caller passes a folder path that passes
  validation (unlikely given the trailing-slash check), DIAL Core may return
  `items`. *Mitigation*: `FileMetadataResponseDto` omits `items`; the service
  method maps only the scalar fields explicitly.

- **No caching** — repeated identical requests hit DIAL Core on every call.
  Acceptable: file metadata TTL is undefined and write operations can change it
  at any time. Caching is a follow-on concern.

## Open Questions

None — the SDK method exists, the path convention is documented, and the
validation strategy is clear from existing DTO patterns.
