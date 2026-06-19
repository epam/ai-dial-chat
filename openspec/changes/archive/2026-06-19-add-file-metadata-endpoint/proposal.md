## Why

The Chat API `GET /api/v1/files/list` endpoint always appends a trailing `/` to
the path before calling DIAL Core, forcing every lookup to be treated as a
folder listing. There is no way for a caller to retrieve metadata for a single
file (size, content-type, etag, permissions). This blocks use-cases such as
pre-flight existence and permission checks before displaying or downloading a
specific file.

## What Changes

- **New**: `GET /api/v1/files/metadata?bucket={bucket}&path={filePath}` —
  returns metadata for a single named file, passing the path to DIAL Core
  **without** a trailing `/`.
- **New**: `GetFileMetadataQueryDto` — DTO with `bucket` + `path` (required,
  allowlist-validated, non-empty).
- **New**: `FileMetadataResponseDto` — typed response DTO mirroring the DIAL
  Core single-file shape (`name`, `nodeType`, `contentLength`, `contentType`,
  `etag`, `createdAt`, `updatedAt`, `permissions`, etc.).
- **New**: `FilesService.getFileMetadata()` — calls the existing
  `this.client.getFileMetadata(bucket, path, …)` SDK method without appending
  `/`; maps errors via the existing `handleDialError` utility.
- **New**: `getFileMetadata` export in `apps/chat/src/server-api/files.api.ts`
  wrapping the generated `filesApi.getFileMetadata(…)` client method.
- **Updated**: Swagger/OpenAPI annotations → `npm run openapi` + `npm run
  openapi:check` to regenerate `@epam/chat-api-client`.
- **Unchanged**: `GET /api/v1/files/list` contract and behavior.

## Capabilities

### New Capabilities

- `file-metadata-get`: Single-file metadata retrieval through the Chat API BFF —
  authenticated, token-forwarded, path-validated, DIAL SDK-backed endpoint that
  returns a typed FileMetadataResponseDto for a specific file path.

### Modified Capabilities

*(none — the `file-list` spec contract is not changing)*

## Impact

- **apps/chat-api**: `src/files/` — new service method, new DTO files, new
  controller handler; no new module or env var required.
- **libs/chat-api-client**: regenerated from updated Swagger — hand-edited files
  under `src/generated/` must not be touched.
- **apps/chat**: `src/server-api/files.api.ts` — one new exported wrapper
  function.
- **No UI changes**: no new user-visible strings, no i18n keys, no RTL or
  accessibility impact.
- **Backward compatibility**: the existing `GET /api/v1/files/list` endpoint is
  not modified; callers are unaffected.
- **Rollback**: the new endpoint can be removed in a single PR without touching
  any existing endpoint, DTO, or frontend path.
