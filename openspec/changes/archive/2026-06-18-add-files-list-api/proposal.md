## Why

The Chat frontend has no route through which it can browse the user's DIAL Core file storage. DIAL Core exposes `GET /v1/metadata/files/{Bucket}/{Path}` for folder listing, but the BFF contract forbids direct browser access — all calls must be proxied through `apps/chat-api` so DIAL Core access tokens remain server-side. Without this endpoint, the upcoming FileManager UI surface (`@epam/ai-dial-ui-kit` `FileManager`) has nothing to list.

## What Changes

- Add `GET /api/v1/files/list` endpoint to `apps/chat-api` — proxies `client.getFileMetadata()` from `@epam/ai-dial-typescript-sdk` and returns a FileManager-compatible `ListFilesResponseDto`.
- Add `apps/chat-api/src/files/dto/list-files.dto.ts` with `ListFilesQueryDto` and `ListFilesResponseDto`.
- Extend `apps/chat-api/src/files/files.service.ts` with a `listFiles()` method.
- Extend `apps/chat-api/src/files/files.controller.ts` with a `listFiles` handler.
- Regenerate `@epam/chat-api-client` to expose `filesApi.listFiles(...)`.
- Add a `listFiles()` wrapper to `apps/chat/src/server-api/files.api.ts`.

## Capabilities

### New Capabilities

- `file-list`: Accept a validated bucket and optional path from the browser, forward the request to DIAL Core `GET /v1/metadata/files/{Bucket}/{Path}` under the authenticated user's session, normalize folder/file items into a `DialFile`-compatible JSON shape, and return paginated results with a `nextToken`.

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Non-goals

- File upload, download, delete, create-folder, rename, copy, and move — deferred to future changes.
- Caching list responses at the BFF layer — DIAL Core is the source of truth; stale listings cause data loss.
- Recursive deep-tree pre-fetch — callers drive pagination and depth via `recursive` + `token` query params.
- Direct browser-to-DIAL-Core access.
- Transforming, filtering, or enriching file metadata beyond normalization for FileManager compatibility.

## Acceptance Criteria

1. `GET /api/v1/files/list?bucket=my-bucket&path=folder/` returns `200` with an `items` array; each item has `name`, `path`, `folderId`, `nodeType`, `bucket`, `parentPath`, `url`, `updatedAt` at minimum.
2. Folder items: `nodeType: "folder"`, trailing-slash path, stable `folderId` (`${bucket}:${path}`), no `contentLength`/`contentType`.
3. File items: `nodeType: "item"`, no forced trailing slash, `folderId` matching the parent folder's ID.
4. DIAL uppercase `"ITEM"` / `"FOLDER"` values are mapped to lowercase `"item"` / `"folder"`.
5. Root listing (`path` omitted or `""`) works without error.
6. `nextToken` from DIAL round-trips into `ListFilesResponseDto.nextToken`.
7. DTO validation rejects: leading `/` in path, `..` path segments, bucket containing slashes or colons, `limit` outside 1–1000.
8. Unauthenticated requests return `401` before reaching DIAL Core.
9. DIAL Core `403` / `404` / `429` / `5xx` / timeout map to the correct BFF HTTP exceptions.
10. Handler named `listFiles` generates `filesApi.listFiles(...)` with strong TypeScript types (no `any`).
11. `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` all pass.
12. `npm run openapi && npm run openapi:check` pass after the backend slice.

## Alternatives Considered

- **Raw fetch instead of SDK** — rejected; `getFileMetadata` is a standard JSON endpoint with no streaming requirement; the SDK is the correct choice per AGENTS.md §4.
- **Separate `/files/folders` endpoint** — rejected; flat vs. folder listing is controlled by the `recursive` query param, keeping the API surface minimal.
- **Caching the listing** — rejected; file lists change on user upload/delete; no safe TTL can be justified without a cache-invalidation event from DIAL Core.

## Rollback / Backward Compatibility

Additive change — no existing endpoints, DTOs, or clients are modified. The new `listFiles` handler, service method, and generated SDK method can be removed without affecting `uploadFile` or `downloadFile`. No database migrations, feature flags, or session changes are involved.

## Closest Existing Files

- Controller pattern → `apps/chat-api/src/files/files.controller.ts:33` (same domain, versioning, auth, throttle pattern)
- Service pattern → `apps/chat-api/src/files/files.service.ts:39` (same SDK client, `getBearerAuthHeaders`, `handleDialError`)
- DTO pattern → `apps/chat-api/src/files/dto/file-params.dto.ts` (bucket + path allowlist validation; new DTO extends or mirrors this)
- Frontend wrapper pattern → `apps/chat/src/server-api/files.api.ts` (same `filesApi` singleton, same delegation pattern)
- Archived full design → `openspec/changes/archive/2026-05-28-add-files-transfer-api/design.md`

## i18n Impact

No new user-visible strings are introduced by this backend-only endpoint and its frontend wrapper. Error display for listing failures is the consuming component's responsibility. When a FileManager UI feature is built on top of this API (a future change), i18n keys will be added there.
