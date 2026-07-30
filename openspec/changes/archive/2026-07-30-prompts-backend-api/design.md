## Context

The application currently has no saved-prompts library. System prompts exist only as a `string` field on individual `Conversation` objects. This design adds a dedicated `prompts` domain to `apps/chat-api` that gives clients full CRUD over named, reusable prompt templates stored in DIAL Core file storage. The design follows the established conversations domain as the primary reference pattern.

No new external dependencies are introduced — the existing DIAL Core SDK client (`@epam/ai-dial-typescript-sdk` via `AppService`) and the file-storage read/write/list/delete primitives already used by conversations are sufficient.

## Goals / Non-Goals

**Goals:**
- REST API for creating, reading, updating, deleting personal prompt templates (`/api/v1/prompts`)
- Read-only API for organisation (public-bucket) prompts (`/api/v1/prompts/public`)
- Virtual folder hierarchy via DIAL Core path prefixes, with explicit folder create / rename / delete operations
- Re-use of the existing `/api/v1/share` endpoint for sharing prompt resources
- Full NestJS conventions: thin controller, service logic, validated DTOs, Swagger, URI versioning, `@Throttle`
- Generated client update (`npm run openapi`) after implementation

**Non-Goals:**
- Frontend UI — addressed in a follow-on change
- Prompt execution or variable substitution at the API layer
- Admin-managed organisation prompts write API (org prompts are read-only for regular users)

## Decisions

### 1. Storage: native DIAL Core prompt resources with path-as-ID

**Decision:** Prompts use DIAL Core's prompt resource API. The resource type and bucket are
already encoded by the SDK endpoint, so the SDK receives only the user-relative prompt path.

Full DIAL resource URL: `prompts/{bucket}/{userPath}`
- Personal: `prompts/{sessionBucket}/{path}`
- Organisation: `prompts/public/{path}`

The BFF's `path` and response `id` contain only `{userPath}`. The full resource URL is used
only at the DIAL integration boundary, including sharing. This matches the legacy chat's
`getPromptRootId()` / `PromptApiStorage` convention; no `.json` suffix or extra nested
`prompts/` segment is added.

`description` and `content` are prompt payload fields. `createdAt` and `updatedAt` are sourced
from DIAL Core resource metadata and are not written into the prompt payload.

**Alternative considered:** Assign UUID identifiers and store path separately.
**Rejected because:** Adds a secondary index that DIAL Core doesn't provide. All existing domain entities (conversations, files) use path-as-ID; diverging would be inconsistent and adds complexity.

### 2. Folder hierarchy: virtual path prefixes

**Decision:** Folders are not first-class DIAL Core objects. They are implicit — a folder `Work/AI/` exists when at least one prompt lives at `Work/AI/{name}`. Explicit folder create/rename/delete operations are supported:
- **Create**: a sentinel prompt resource is written at
  `prompts/{bucket}/{folderPath}/.folder` to make empty folders listable by this BFF
- **Rename / delete**: all files with the given path prefix are moved / deleted in parallel using DIAL Core batch operations

**Alternative considered:** Single flat namespace with `folderId` stored inside the JSON.
**Rejected because:** DIAL Core's native list-by-prefix is efficient and consistent with conversations; embedding folderId in JSON would require a full scan to list contents of a folder.

### 3. Organisation prompts: public bucket read-only

**Decision:** `GET /api/v1/prompts/public` lists organisation prompts and
`GET /api/v1/prompts/public/item?path=<p>` reads one organisation prompt. Both use the DIAL
`public` bucket (`prompts/public/{path}`). Regular users may only read; no public write route is
exposed.

**Rationale:** Consistent with how conversations expose `PUBLIC_BUCKET` data (`GET /api/v1/conversations/public`). Organisation prompts are curated by admins through DIAL Admin or the file system, not through this API.

### 4. Sharing: reuse existing `/api/v1/share`

**Decision:** No new share endpoint. Clients POST to the existing `POST /api/v1/share` with
`itemId: "prompts/{bucket}/{path}"`. The existing BFF share service proxies that resource URL
to DIAL Core and returns its established `ShareLinkResponseDto`
(`url`, `expiresInDays`, `access`).

**Rationale:** Adding a prompt-specific wrapper would be pure duplication. The `conversation-share` spec established this precedent — the existing endpoint accepts any DIAL Core path.

### 5. Module structure

`apps/chat-api/src/prompts/` following the established domain pattern (no `modules/` wrapper):
```
prompts/
  prompt.controller.ts
  prompt.service.ts
  prompt.module.ts
  constants/
    prompt.constants.ts
  dto/
    create-prompt.dto.ts
    update-prompt.dto.ts
    prompt-response.dto.ts
    prompt-list-response.dto.ts
    move-prompt.dto.ts
    prompt-path.dto.ts
    create-prompt-folder.dto.ts
    rename-prompt-folder.dto.ts
    prompt-folder-response.dto.ts
```

`PromptModule` is imported in `AppModule`.

### 6. Authorization

All personal-prompt endpoints require an authenticated session (existing `SessionGuard` applied globally). The session's `bucket` field identifies the user's personal DIAL Core bucket. Organisation endpoints require authentication but allow any authenticated user read access. No prompt-specific RBAC is introduced in this change.

## Risks / Trade-offs

- **Folder rename cost** → Mitigation: Folder rename rewrites all files under the prefix. For large folders this is a sequence of DIAL Core PUT + DELETE calls. This is acceptable for the expected prompt-library scale (tens to low hundreds of items). If performance becomes a concern, a background job or DIAL Core bulk-rename API can replace it later.
- **Concurrent edits** → Mitigation: DIAL Core last-write-wins semantics apply (no optimistic locking). This is the same trade-off accepted for conversations and is acceptable for a personal-use library.
- **Public-bucket write access** → Mitigation: The service checks bucket identity on write operations and returns 403 for any `public/...` path, preventing accidental or malicious org-prompt writes.

## Migration Plan

This is a purely additive change — no existing data or endpoints are modified. No migration steps required. Running `npm run openapi && npm run openapi:check` after implementation regenerates the client.

### 7. Unambiguous read operations

**Decision:** Listing and single-item reads use separate OpenAPI operations:
- `GET /api/v1/prompts` and `GET /api/v1/prompts/public` return list DTOs.
- `GET /api/v1/prompts/item?path=...` and `GET /api/v1/prompts/public/item?path=...` return `PromptResponseDto`.

This keeps generated client response types sound. Metadata listing follows every DIAL Core
`nextToken` page. Personal lists include `sharedWithMe`; a failure of that optional lookup
degrades to an empty array without hiding failures of the primary personal listing.

### 8. Path safety and multi-step mutations

All user-supplied names and slash-separated paths use allowlist validation. Traversal segments
(`.` and `..`), backslashes, absolute paths, and empty path segments are rejected before any
DIAL Core call.

Rename and move are implemented as write-target then delete-source because the SDK has no
atomic rename primitive for this resource. Any failed step is surfaced as an upstream error;
the API never reports a successful move, rename, or folder delete after a partial failure.
