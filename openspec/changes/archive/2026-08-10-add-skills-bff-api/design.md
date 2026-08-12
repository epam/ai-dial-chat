## Context

`apps/chat-api` proxies every DIAL Core resource type behind an authenticated, session-cookie BFF so the browser never holds a DIAL Core access token — see `apps/chat-api/src/files/`, `apps/chat-api/src/deployments/`, `apps/chat-api/src/share/`, `apps/chat-api/src/publish/`. DIAL Core added a Skills resource (`ResourceType`/`ResourceTypes` enum now includes `'SKILL'` — confirmed in the SDK schema, sibling checkout `ai-dial-typescript-sdk/src/schema.ts:3897,3929`) with a full CRUD + grouping-folder API, but no `chat-api` domain proxies it yet.

**SDK-version prerequisite (verified, not assumed):** the pinned SDK version, `0.1.0-dev.31` (root `package.json`, `apps/chat-api/package.json`), exposes only `downloadSkillFolder`/`uploadSkillFolder`/`deleteSkillFolder`/`downloadSkillFile`/`uploadSkillFile`/`deleteSkillFile`. The complete API — adding `listSkillMetadata`, `listSkillFileMetadata`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder`, `downloadSkillGroupingFolder` — was verified two ways:

1. **Local SDK source checkout** (`/Users/Valery_Dluski/projects/dial/ai-dial-typescript-sdk`, a sibling repo on this machine, HEAD `fa8daa7`): `src/client.ts`, `src/api-paths.ts`, and `src/schema.ts` already declare all 11 skill operations against `/v2/skills/**` and `/v2/metadata/skills/**` paths. This is source-of-truth ground truth for every DTO/status-code claim in this design — every citation below with a `schema.ts:<line>` reference comes from reading that file directly, not from memory or the task brief.
2. **npm registry query** (`https://registry.npmjs.org/@epam/ai-dial-typescript-sdk`, live network access confirmed available): dist-tag `development` → `0.1.0-dev.35`, published 2026-08-04 — the newest of 26 published `0.1.0-dev.*` versions. The `latest` dist-tag is stale, pointing at `0.1.0-dev.21`; **do not** pin via `latest`. This confirms the task brief's stated `0.1.0-dev.35` at time of writing this design.

No further recheck is possible from here (this change does not run `npm install`), so the target pin is documented as `0.1.0-dev.35` with the above verification trail; **Task 1.1 in tasks.md must re-run the registry check immediately before the real dependency bump**, since new dev builds may have published between this analysis and implementation.

**Non-goals of this analysis**: DIAL Core issue #1633 and its child issues (#1634–1638, #1640–1642) were requested as reading material but were not reachable — no `gh` access to a `dialx-ai/dial-core`-equivalent repo was available in this environment, and no cached copy exists locally. Every claim in this design is instead grounded in the released SDK schema, which the task explicitly instructs to prefer over the issue text on any conflict. Two concrete conflicts were found (see D1, D8) and are documented rather than silently resolved in the issue's favor.

## Goals / Non-Goals

**Goals:**
- Define a complete, versioned `/api/v1/skills` BFF contract for all 10 addressable skill operations plus the `downloadSkillGroupingFolder` negative contract.
- Decompose the domain into a facade + focused services from day one, mirroring `deployments-toolsets-service-decomposition`, so no god-service is created that later needs a follow-up refactor change.
- Ground every DTO, status code, and header-forwarding rule in the verified SDK schema rather than the task brief's assumptions, and flag every place the two disagree.
- Specify the minimal, narrow sharing/publication touch points needed to treat a skill as a whole-resource shareable/publishable unit.

**Non-Goals:**
- No skill-management UI, no React components, no i18n/RTL/accessibility work.
- No implementation of the SDK version bump itself (described only — root/`chat-api` `package.json`/`package-lock.json` stay unmodified by this change).
- No caching layer for skill data (see D7).
- No resolution of the skill publish name/version strategy — recorded as an explicit open question (D8), not invented.
- No `SkillsGroupingFolderService` — grouping-folder create/delete are structural mutations owned by `SkillsMutationService` (see D3).

## Decisions

### D1 — Whole-skill upload/download is single-ZIP, not `files[]`/`relativePaths[]`

The task brief specified a `files[]`/`relativePaths[]` multipart array contract for whole-skill upload. The verified SDK schema disagrees: `uploadSkillFolder`'s `requestBody` is

```ts
requestBody: {
  content: {
    'multipart/form-data': {
      /** Format: binary */
      file: string;
    };
  };
};
```

(`ai-dial-typescript-sdk/src/schema.ts:17420-17427`) — a single `file` field, symmetric with `downloadSkillFolder`'s single `'application/zip': string` response body (`schema.ts:17326-17329`). Per the task's own tie-breaking rule, **the released schema wins**: whole-skill upload accepts one ZIP archive containing `SKILL.md` at its root plus every skill file, exactly mirroring the shape `downloadSkillFolder` returns. `uploadSkillFile` (single in-skill file) genuinely does take one `file` field (`schema.ts:17847-17854`), which does match a single-file multipart shape — no discrepancy there.

This means `SkillsUploadService.uploadSkill`'s validation responsibility (path traversal, reserved markers, `SKILL.md` presence/no-deletion, duplicate paths) is enforced by **inspecting ZIP entries before forwarding the archive to DIAL Core**, not by validating separate multipart fields. This reuses the exact tooling `apps/chat-api/src/files/upload/files-upload.service.ts` already has for `uploadArchive` (`yauzl`, `resolveArchiveEntryPath` zip-slip defense, `decodeArchiveEntryName`) — see D4.

### D2 — ETag / `If-Match` / `If-None-Match` forwarding matrix (verified per-operation, not assumed uniform)

The task brief assumed `If-Match` is forwardable uniformly on "whole-skill, single-file, and grouping-folder mutations," and asked to forward `If-None-Match` on downloads "if supported." The verified schema shows this is **not uniform**:

| Operation | Request `If-Match`? | Request `If-None-Match`? | Response `ETag`? |
|---|---|---|---|
| `downloadSkillFolder` | No (`header?: never`, `schema.ts:17306`) | No (same) | Yes |
| `uploadSkillFolder` | **Yes**, optional (`schema.ts:17408-17411`) | n/a | Yes |
| `deleteSkillFolder` | **Yes**, optional (`schema.ts:17516-17519`) | n/a | No |
| `downloadSkillGroupingFolder` | No (`header?: never`) | No | n/a (no 200 defined at all) |
| `createSkillGroupingFolder` | **No** (`header?: never`, `schema.ts:17631-17633`) | n/a | Yes |
| `deleteSkillGroupingFolder` | **Yes**, optional (`schema.ts:17692-17695`) | n/a | No |
| `downloadSkillFile` | No (`header?: never`) | No | Yes |
| `uploadSkillFile` | **Yes**, optional (`schema.ts:17833-17836`) | n/a | Yes |
| `deleteSkillFile` | **Yes**, optional (`schema.ts:17920-17923`) | n/a | Yes |

Two discrepancies with the task brief:
- **`createSkillGroupingFolder` has no request headers at all** — the BFF cannot forward `If-Match` there no matter what the brief assumes. The BFF endpoint accepts no conditional header for this operation; documented, not silently dropped.
- **No skill download operation supports `If-None-Match`**, despite `downloadSkillFolder` declaring a `304 Not Modified` response (`schema.ts:17330-17336`). This is upstream schema debt: a response code with no way to trigger it via any documented request parameter. The BFF does **not** fabricate an `If-None-Match` passthrough Core doesn't accept for this operation family; if Core's real runtime behavior differs from its published schema (accepts the header despite the schema omitting it), that would need to be verified against a live Core instance before this design's downloadSkill/downloadSkillFile 304 scenarios can be implemented as anything but "theoretically possible, currently unreachable via documented request shape."

### D3 — Service ownership map (facade + 4 focused services, no dedicated grouping-folder service)

Mirrors `deployments-toolsets-service-decomposition` (`openspec/specs/deployments-toolsets-service-decomposition/spec.md`) and its concrete implementation (`apps/chat-api/src/deployments/deployments.service.ts:1-47`, `apps/chat-api/src/deployments/deployments.module.ts`):

| Service | Owns | SDK calls |
|---|---|---|
| `SkillsListingService` | `listSkills`, `listSkillFiles`; pagination forwarding (`token`/`limit`/`recursive`); mapping `MetadataBase` → BFF DTOs; rejecting malformed upstream metadata | `listSkillMetadata`, `listSkillFileMetadata` |
| `SkillsLookupService` (justified — see D9) | Resolving one skill from a `skills/{bucket}/{path}` URL into a normalized single-skill DTO for `ShareService.acceptInvitation`'s post-accept summary resolution, mirroring `DeploymentsLookupService.resolveDeploymentItem`/`ToolsetsService.resolveToolsetItem` | `listSkillMetadata` (targeted, not bulk) |
| `SkillsUploadService` | `uploadSkill`, `uploadSkillFile`; ZIP-entry validation (D1/D4); BFF ingress limits; upstream body construction; `If-Match` forwarding where supported (D2); returning new `ETag`; timeouts/error mapping | `uploadSkillFolder`, `uploadSkillFile` |
| `SkillsDownloadService` | `downloadSkill`, `downloadSkillFile`; stream acquisition; safe header forwarding; grouping-folder-download rejection; cancellation on disconnect | `downloadSkillFolder`, `downloadSkillFile` |
| `SkillsMutationService` | `deleteSkill`, `deleteSkillFile`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder`; `If-Match` forwarding where supported; conflict/precondition mapping; mutation `ETag`s | `deleteSkillFolder`, `deleteSkillFile`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder` |
| `SkillsService` (facade) | Pure bound-property delegation, one method → exactly one sub-service, `<150` lines | none |

No dedicated grouping-folder service: `createSkillGroupingFolder`/`deleteSkillGroupingFolder` share no state, no cache, and no cross-cutting dependency with the rest of `SkillsMutationService`'s deletes — folding them in avoids the "another forwarding layer" anti-pattern the task brief warns against, matching how `deployments-toolsets-service-decomposition` kept toolset login/logout in a dedicated `ToolsetsAuthService` only because that genuinely owns interruption/auth state, not because every sub-concern gets its own service.

### D4 — Path/filename validation rules (reuses `IsValidFilePath`, extends the reserved-marker set)

`apps/chat-api/src/files/dto/file-path.validator.ts:7-30` (`IsValidFilePath`) already rejects a leading `/`, `..`, forbidden characters (`:;,={}&\"\\`), and invalid/path-separator percent-encoding. Skill paths, file paths, and grouping-folder paths reuse this validator (imported the same way `publish`/`share` DTOs already do — `apps/chat-api/src/publish/dto/catalog-entity-params.dto.ts:3`, `apps/chat-api/src/share/dto/create-share-link.dto.ts:9`).

Beyond `IsValidFilePath`, skill-specific validation (in `SkillsUploadService`/`SkillsMutationService`, not the DTO layer, since it's ZIP-entry-level not scalar-field-level) additionally rejects, per relative path segment:
- Empty segments (`a//b`)
- `.` and `..` segments (defense-in-depth on top of `IsValidFilePath`'s coarser `..` substring check)
- NUL and other control characters (`\x00`–`\x1f`)
- The literal segments `.dial-resource` and `.dial-folder` (DIAL Core's own internal marker files/folders — never valid inside a user-uploaded skill archive)
- The literal first-segment names `files` and `v` (reserved structural segments — collision risk with DIAL Core's own `/v2/skills/...`-shaped internal addressing were they ever nested)
- Duplicate relative paths within the same upload (two ZIP entries resolving to the same path)
- Any attempt to delete `SKILL.md` via `deleteSkillFile` (checked in `SkillsMutationService.deleteSkillFile` before the SDK call — `filePath === 'SKILL.md'` after normalization)

This reuses the zip-slip defense already proven in `apps/chat-api/src/files/upload/files-upload.service.ts:654-670` (`resolveArchiveEntryPath`) as its base, extended with the additional reserved-marker checks above — not reimplemented from scratch.

`SKILL.md` presence is required at the archive root for `uploadSkill` (whole-skill create/replace); DIAL Core remains authoritative for YAML-frontmatter validation of `name`/`description` inside it — the BFF only checks the file's presence and path, never parses its content.

### D5 — Streaming strategy (identical to `files-download.service.ts`)

`downloadSkill`/`downloadSkillFile` return a typed transport value, not a hand-written response:

```ts
interface SkillDownload {
  stream: ReadableStream;
  headers: Record<string, string>;
  abortOnDisconnect?: () => void;
}
```

matching the task brief exactly and `apps/chat-api/src/files/download/files-download.service.ts:29-33`'s existing `{ stream, headers }` return shape (that one omits `abortOnDisconnect` — `downloadArchive`'s equivalent, `apps/chat-api/src/files/files.controller.ts:415-434`, is the closer model for including it, since skill ZIP generation is comparably long-running). `SkillsController` pipes the stream into the Express response exactly like `apps/chat-api/src/files/files.controller.ts:597-618` (`downloadFile`) / `:409-435` (`downloadArchive`): `Readable.fromWeb(stream)`, `pipeline()` (never bare `.pipe()`), `res.destroy()` on pipeline failure, and `res.on('close', ...)` calling `abortOnDisconnect()` when the client disconnects before the stream ends. The BFF never buffers a full download body in Node memory.

Safe response-header allowlist (forwarded verbatim, everything else stripped): `content-type`, `content-disposition`, `content-length`, `etag` — extending `apps/chat-api/src/files/download/files-download.service.ts:10-14`'s `SAFE_DOWNLOAD_HEADERS` (which lacks `etag`, since plain file downloads don't version) with `etag`, since skill downloads carry a resource-version `ETag` the file-download endpoint has no equivalent for.

### D6 — Multipart contract (concrete BFF shapes)

**`PUT /api/v1/skills` (`uploadSkill`)**: `bucket` (form field), `path` (form field, grouping-folder-relative skill path), `file` (binary, the whole-skill ZIP), optional `If-Match` header. `FileInterceptor('file')` + `memoryStorage`, mirroring `apps/chat-api/src/files/files.controller.ts:69-119`'s `uploadFile` route — bounded by `SKILL_UPLOAD_MAX_BYTES` (multer `limits.fileSize`), the ZIP is then opened with `yauzl` in `SkillsUploadService` to validate entries per D4 before the raw multipart body (not the extracted files) is forwarded to `uploadSkillFolder` unchanged — DIAL Core does its own ZIP extraction server-side, so the BFF's job is pre-validation and pass-through, not re-packaging.

**`PUT /api/v1/skills/files` (`uploadSkillFile`)**: `bucket`, `path` (skill path), `filePath` (relative path inside the skill, validated per D4), one binary `file`, optional `If-Match` — structurally identical to `apps/chat-api/src/files/files.controller.ts:69-119`'s existing single-file upload route, just with an extra `filePath` field.

### D7 — Cache decision: none in this initial implementation

Skill metadata and binary content are user-scoped, permission-sensitive, and mutable, and already carry DIAL Core's own ETag-based concurrency control (D2). Unlike `deployments:list:*` (which has one well-known, cheap invalidation trigger — share-accept, `apps/chat-api/src/share/share.service.ts:289-292`), skill mutations (`uploadSkill`, `deleteSkill`, per-file mutations, grouping-folder create/delete) all originate from this same BFF and would each need to invalidate the same cache key — more invalidation call sites than the read paths they'd be optimizing, for a domain with no verified hot-path yet. Ship without caching; add it later with a concrete profiling justification and an invalidation-trigger inventory, not preemptively.

### D8 — Skill publish name/version strategy is an open question, not invented (task brief vs. verified convention)

`apps/chat-api/src/publish/publish.service.ts:37-49` (`splitEntityNameAndVersion`) and its doc comment (`publish.service.ts:30-35`) are explicit: catalog entity names are always `{name}__{version}` because that's how `applications.service.ts`/`toolsets.service.ts` name resources at creation time. Skill resource paths carry no such convention — the task brief itself says "Skills may be nested under grouping folders; their version belongs to `SKILL.md` metadata," which the verified SDK metadata schema does **not** expose (`ResourceItemMetadata`/`ResourceFolderMetadata` — `schema.ts:3805-3840` — have no `name`/`description`/`version` fields beyond the generic `name` = resource-path segment; skill-specific frontmatter is file content, not metadata).

Two consequences, both left as **open questions** rather than invented fixes (task instruction: "Record missing summary or publication-version data as an explicit open question instead of inventing it"):
1. `PublishCatalogEntityDto.version` (already a required client-supplied field, `apps/chat-api/src/publish/dto/publish-catalog-entity.dto.ts:30-36`) still works as an *input* for a skill publish request — the caller already supplies it. But `PublishService.getPublishHistory`'s version-*recovery* (`publish.service.ts:148-204`, via `splitEntityNameAndVersion(entityId)`) reads the version back out of the entity id's `__{version}` suffix. For a skill `entityId` with no such suffix, this recovery silently returns `version: ''` — a real correctness gap for skill publish-history display, not something this change should paper over with an invented parsing rule.
2. `PublishService.publish`'s publication title (`"{entityName} {version}"`) uses `splitEntityNameAndVersion`'s `name` half, which for a skill would just be the skill's last path segment (correct by coincidence, since there's no `__` to split on) — acceptable as a display name, but doesn't surface the skill's real declared name from `SKILL.md` frontmatter (which DIAL Core validates but does not expose via the metadata schema). Whether this is good enough, or whether publish should fetch `SKILL.md` content just to extract a title, is left open.

Also open: `getResourceName(entityId)` (`publish-target.util.ts:38-40`) returns only the last path segment for `targetUrl` construction — for a skill nested two or more grouping-folder levels deep, publishing preserves only the leaf name, not the grouping-folder subpath, in the published `targetUrl`. Two differently-nested skills sharing a leaf name would collide if published to the same folder. This matches existing applications/toolsets behavior (which never nest below `bucket/name` today) and is not a regression this change introduces, but it becomes a live risk the first time a nested skill is actually published — flagged, not fixed, here.

### D9 — `SkillsLookupService`: justified for sharing, explicitly not wired into publication

Per the task's instruction to omit the service if no verified consumer needs it: `ShareService.acceptInvitation`'s `resolveSharedItemSummary` (`share.service.ts:316-359`) already branches by prefix to resolve a just-accepted share into a UI-ready summary (`sharedDeployment` via `DeploymentsService.resolveDeploymentItem`, `sharedToolset` via `ToolsetsService.resolveToolsetItem`). A shared skill accepted through the same generic `/api/v1/share`+`/accept` flow needs the identical treatment — a `sharedSkill` branch calling `SkillsLookupService.resolveSkillItem(itemId, ...)`. This is a genuine, verified consumer need matching an established pattern — the service is justified and `SkillsModule` exports it (not the full `SkillsService` facade) for `ShareModule` to import, exactly as `DeploymentsModule` exports `DeploymentsDetailsService` (`deployments.module.ts:18`) for cross-domain use without going through the full facade.

`PublishService`, by contrast, has **no verified need** for `SkillsLookupService` today: `PublishCatalogEntityDto.version` is already caller-supplied, and `publish.service.ts` derives its title from `entityId` string manipulation, not from a details lookup. Wiring a `SkillsLookupService` dependency into `PublishModule` now, before a concrete need exists, would be exactly the "another forwarding layer" the task brief warns against. No `PublishService → SkillsLookupService` dependency is added; D8's open questions are left for a follow-up change once the real requirement (e.g. "publish should show the skill's real name from `SKILL.md`") is confirmed.

### D10 — No existing frontend UI consumer to migrate

`apps/chat/src/` was checked for any existing `skill`-related UI surface (route, component, context, or `server-api` wrapper) that would need migrating onto the new BFF contract — none exists. This is a net-new backend capability with no UI debt to carry forward, consistent with the task's explicit "No skill-management UI is part of this change" instruction.

## Complete Endpoint Matrix

| operationId | Method & path | SDK method | Rate limit | Success | Auth |
|---|---|---|---|---|---|
| `listSkills` | `GET /api/v1/skills` | `listSkillMetadata` | 60/60s | 200 `SkillListResponseDto` | session |
| `listSkillFiles` | `GET /api/v1/skills/files` | `listSkillFileMetadata` | 60/60s | 200 `SkillFileListResponseDto` | session |
| `downloadSkill` | `GET /api/v1/skills/download` | `downloadSkillFolder` (or 400 negative-contract branch if path is a grouping folder) | 30/60s | 200 streamed `application/zip` | session |
| `uploadSkill` | `PUT /api/v1/skills` | `uploadSkillFolder` | 5/60s | 200 `SkillUploadResponseDto { etag }` | session |
| `deleteSkill` | `DELETE /api/v1/skills` | `deleteSkillFolder` | 10/60s | 200 `{ success: true }` | session |
| `downloadSkillFile` | `GET /api/v1/skills/files/download` | `downloadSkillFile` | 30/60s | 200 streamed, `Content-Type` per file | session |
| `uploadSkillFile` | `PUT /api/v1/skills/files` | `uploadSkillFile` | 20/60s | 200 `SkillFileUploadResponseDto { etag }` | session |
| `deleteSkillFile` | `DELETE /api/v1/skills/files` | `deleteSkillFile` | 10/60s | 200 `SkillFileDeleteResponseDto { etag }` | session |
| `createSkillGroupingFolder` | `POST /api/v1/skills/grouping-folders` | `createSkillGroupingFolder` | 10/60s | 201 `SkillGroupingFolderResponseDto { etag }` | session |
| `deleteSkillGroupingFolder` | `DELETE /api/v1/skills/grouping-folders` | `deleteSkillGroupingFolder` | 10/60s | 200 `{ success: true }` | session |

`downloadSkillGroupingFolder` is not its own route (schema defines no `200` at all, only `400`/`403`/`500` — `schema.ts:17589-17628`) — it is the failure branch `downloadSkill` takes when `SkillsDownloadService` determines the target path is a grouping folder (via a preceding `listSkillMetadata` check or by observing DIAL Core's own `400` from a direct `downloadSkillFolder` call against a grouping-folder path — see the `skills-bff-api` spec for the exact detection rule).

**Authorization**: every route requires a valid session (enforced by the existing global session guard, same as every other domain controller); DIAL Core remains the sole authorizer of bucket/skill access via the forwarded bearer token — the BFF makes no role/permission decisions of its own.

## Request/Response DTO Sketches

```ts
// apps/chat-api/src/skills/dto/skill-metadata.dto.ts
export enum SkillNodeType { Folder = 'folder', Item = 'item' } // lowercased NodeType, matching ListFilesItemDto convention

export class SkillMetadataItemDto {
  name!: string;
  path!: string;           // relative path within bucket
  url!: string;             // skills/{bucket}/{path}
  bucket!: string;
  nodeType!: SkillNodeType;
  parentPath?: string;
  permissions?: string[];   // READ/WRITE/SHARE, from ResourceAccessType
  etag?: string;            // item only
  author?: string;          // item only
  createdAt?: number;
  updatedAt?: number;
}

export class SkillListResponseDto {
  bucket!: string;
  path!: string;
  items!: SkillMetadataItemDto[];
  nextToken?: string;
}

// same shape reused for listSkillFiles as SkillFileListResponseDto (files scoped inside one skill)
```

```ts
// apps/chat-api/src/skills/dto/skill-list-query.dto.ts
export class SkillListQueryDto {
  bucket!: string;      // @Matches(BUCKET_NAME_PATTERN)
  path?: string;        // @IsValidFilePath(), default ''
  token?: string;
  limit?: number;       // @Min(0) @Max(1000) — schema: "0-1000, default 100"
  recursive?: boolean;
}
// SkillFileListQueryDto extends this + filePath: string (required, @IsValidFilePath())
```

```ts
// apps/chat-api/src/skills/dto/skill-mutation-response.dto.ts
export class SkillUploadResponseDto { etag?: string }
export class SkillFileUploadResponseDto { etag?: string }
export class SkillFileDeleteResponseDto { etag?: string }
export class SkillGroupingFolderResponseDto { etag?: string }
export class SkillOperationResultDto { success!: boolean } // deleteSkill / deleteSkillGroupingFolder
```

**Example — `listSkills`**
```http
GET /api/v1/skills?bucket=my-bucket&path=team-a/&recursive=false&limit=50
```
```json
{
  "bucket": "my-bucket",
  "path": "team-a/",
  "items": [
    { "name": "docs-helper", "path": "team-a/docs-helper", "url": "skills/my-bucket/team-a/docs-helper", "bucket": "my-bucket", "nodeType": "item", "parentPath": "team-a/", "permissions": ["READ", "WRITE"], "etag": "\"abc123\"" },
    { "name": "subteam", "path": "team-a/subteam/", "url": "skills/my-bucket/team-a/subteam/", "bucket": "my-bucket", "nodeType": "folder", "parentPath": "team-a/" }
  ]
}
```

**Example — `uploadSkill`**
```http
PUT /api/v1/skills?bucket=my-bucket&path=team-a/docs-helper
Content-Type: multipart/form-data; boundary=...
If-Match: "abc122"

--boundary
Content-Disposition: form-data; name="file"; filename="docs-helper.zip"
Content-Type: application/zip
<zip bytes: SKILL.md + supporting files>
--boundary--
```
```http
200 OK
ETag: "abc123"
```

**Example — `downloadSkill` against a grouping folder (negative contract)**
```http
GET /api/v1/skills/download?bucket=my-bucket&path=team-a/
```
```json
400 Bad Request
{ "message": "team-a/ is a grouping folder, not a skill — use GET /api/v1/skills?path=team-a/ to list its contents" }
```

## Status-Code Mapping (all 10 operations, verified against schema.ts)

| Status | Meaning here | Mapper change needed |
|---|---|---|
| 200/201 | Success (per operation table above) | — |
| 304 | Not Modified — schema-declared for `downloadSkillFolder` only; unreachable via any documented request header (D2) | — |
| 400 | Invalid path/bucket/multipart, malformed ZIP, missing/invalid `SKILL.md`, reserved-marker violation, or `downloadSkillGroupingFolder`'s "path is a folder" case | — (existing) |
| 401 | No session | — (existing, guard-level) |
| 403 | Core denies permission | — (existing) |
| 404 | Skill / grouping folder / file not found | — (existing) |
| 405 | Invalid operation for the resource kind (e.g. calling a file operation against a grouping folder) — declared on `downloadSkillFolder`/`uploadSkillFolder` (`schema.ts:17371-17377`, `:17479-17485`) | **New** — `mapDialHttpStatus` gains `MethodNotAllowedException` |
| 409 | Non-empty grouping-folder deletion conflict — declared on `deleteSkillGroupingFolder` only (`schema.ts:17738-17744`) | — (existing, `ConflictException`) |
| 412 | ETag/precondition mismatch — declared on every operation that accepts `If-Match` (D2) plus, oddly, `downloadSkillFolder`/`uploadSkillFolder` (`schema.ts:17378-17384`, `:17486-17492`) despite `downloadSkillFolder` accepting no conditional header at all — schema debt, noted | **New** — `mapDialHttpStatus` gains `PreconditionFailedException` |
| 413 | BFF-side ingress limit exceeded (not a Core status — enforced by multer before any Core call) | — (existing) |
| 422 | Core resource validation/limit failure (e.g. invalid `SKILL.md` frontmatter) — declared on `downloadSkillFolder`/`uploadSkillFolder` (`schema.ts:17385-17393`, `:17493-17501`) | **New** — `mapDialHttpStatus` gains `UnprocessableEntityException` |
| 429 | BFF rate limit | — (existing, `@Throttle`) |
| 502 | Unexpected Core response / Core 5xx | — (existing) |
| 503 | Core timeout / network failure / unavailable | — (existing) |

The `mapDialHttpStatus` change (`apps/chat-api/src/common/dial/dial-error.mapper.ts:28-66`) is a three-line addition of `if (status === 405) throw new MethodNotAllowedException(...)`, `if (status === 412) throw new PreconditionFailedException(...)`, `if (status === 422) throw new UnprocessableEntityException(...)`, inserted before the `>= 500` branch — additive, does not change any existing branch's behavior, and ships with dedicated unit tests plus a regression check that the full existing `dial-error.mapper.spec.ts` suite still passes unmodified.

## Rate Limits (rationale)

Listing (60/60s) mirrors `files.controller.ts`'s `list`/`shared`/`public` routes. Downloads (30/60s) sit between the file-download precedent (60/60s, small files) and archive-download precedent (5/60s, heavyweight) since a skill ZIP is bounded but non-trivial. `uploadSkill` (5/60s) matches `uploadArchive`'s posture (heaviest write path — ZIP validation work). `uploadSkillFile`/mutations (10-20/60s) match the existing `files.controller.ts` mutation routes (`folders`, `delete`, `rename`, `copy`, `move`, `revoke-access`, `discard-shared` — all 10/60s).

## Upload Limits (env vars — new, validated on `EnvironmentVariables`)

| Var | Default | Purpose |
|---|---|---|
| `SKILL_UPLOAD_MAX_BYTES` | `104_857_600` (100 MB) | Whole-skill ZIP size cap (multer `limits.fileSize`) — provisional; no verified Core-side limit was found in the SDK schema (Core enforces its own limits server-side regardless; this is the BFF's own ingress guard) |
| `SKILL_UPLOAD_MAX_FILES` | `500` | Max ZIP entries validated before rejecting (mirrors `ARCHIVE_UPLOAD_MAX_FILES`'s role, `files-upload.service.ts:229`) |
| `SKILL_FILE_UPLOAD_MAX_BYTES` | `20_971_520` (20 MB) | Single in-skill-file upload cap |
| `SKILL_TRANSFER_TIMEOUT_MS` | `60_000` | Timeout for all skill SDK calls (higher than `FILE_TRANSFER_TIMEOUT_MS`'s 30s default since ZIP validation adds latency before the upstream call even starts) |

All four are added to `apps/chat-api/src/config/environment.config.ts`, `.env.example`, and documented in `apps/chat-api/README.md`, following the exact pattern `FILE_UPLOAD_MAX_BYTES`/`FILE_TRANSFER_TIMEOUT_MS` already established (`openspec/specs/file-upload/spec.md:113-127`).

## Facade Delegation Design

```ts
@Injectable()
export class SkillsService {
  constructor(
    private readonly listingService: SkillsListingService,
    private readonly uploadService: SkillsUploadService,
    private readonly downloadService: SkillsDownloadService,
    private readonly mutationService: SkillsMutationService,
  ) {}

  listSkills = this.listingService.listSkills.bind(this.listingService);
  listSkillFiles = this.listingService.listSkillFiles.bind(this.listingService);
  uploadSkill = this.uploadService.uploadSkill.bind(this.uploadService);
  uploadSkillFile = this.uploadService.uploadSkillFile.bind(this.uploadService);
  downloadSkill = this.downloadService.downloadSkill.bind(this.downloadService);
  downloadSkillFile = this.downloadService.downloadSkillFile.bind(this.downloadService);
  deleteSkill = this.mutationService.deleteSkill.bind(this.mutationService);
  deleteSkillFile = this.mutationService.deleteSkillFile.bind(this.mutationService);
  createSkillGroupingFolder = this.mutationService.createSkillGroupingFolder.bind(this.mutationService);
  deleteSkillGroupingFolder = this.mutationService.deleteSkillGroupingFolder.bind(this.mutationService);
}
```

`SkillsLookupService.resolveSkillItem` is deliberately **not** on this facade — `ShareModule` injects `SkillsLookupService` directly (D9), matching `ToolsetsListingService`'s direct `DeploymentsDetailsService` dependency in the deployments/toolsets split.

`SkillsModule` registers `SkillsController`, `SkillsService`, `SkillsListingService`, `SkillsLookupService`, `SkillsUploadService`, `SkillsDownloadService`, `SkillsMutationService` as providers; exports `SkillsService` (for any future consumer needing the full facade) and `SkillsLookupService` (for `ShareModule`) — not the other three focused services, since no verified consumer needs them directly yet.

## Cross-Domain Dependency Rules

- `ShareModule` imports `SkillsModule` and injects `SkillsLookupService` directly into `ShareService` — never the `SkillsService` facade.
- No skills sub-service imports `ShareService` or `PublishService` (would create a cycle back into the domain that depends on it).
- `PublishModule` does **not** depend on any skills service in this change (D9) — recorded as a deliberate non-dependency, revisited only when D8's open questions are resolved.
- No `forwardRef` is introduced anywhere in this change.

## Migration Plan

1. Bump the SDK pin (task brief's described-only step; re-verify the registry immediately before doing so).
2. Implement `SkillsModule` fully behind `app.module.ts` registration — additive, no existing route touched, safe to deploy standalone.
3. Ship the `mapDialHttpStatus` 405/412/422 addition in the same or an earlier deploy — it's backward compatible (only affects previously-unmapped statuses) and could land ahead of the rest of the skills domain if useful for staging.
4. Ship the sharing/publication DTO allowlist extensions (`skills` prefix) once `SkillsLookupService` exists, so `ShareService`'s new branch has something to call.
5. Regenerate `chat-api-client`, wire the frontend `skills.api.ts` wrapper — no UI consumes it yet, so this step carries zero user-facing risk and can ship independently.

**Rollback**: see proposal.md's Compatibility and Rollback section — every step here is independently revertible with no persisted state.

## Open Questions

1. **Skill publish name/version strategy** (D8) — should `PublishService` fetch `SKILL.md` content for a real display name, or accept the leaf-path-segment fallback indefinitely? Left unresolved.
2. **Skill publish-history version recovery** (D8) — `splitEntityNameAndVersion`'s `__{version}` convention doesn't apply to skills; no replacement is proposed here.
3. **Nested-grouping-folder collision in publish `targetUrl`** (D8) — `getResourceName`'s last-segment-only behavior could collide two differently-nested skills sharing a leaf name once skill publish is implemented.
4. **`If-None-Match` on skill downloads** (D2) — the schema declares a `304` response for `downloadSkillFolder` with no way to trigger it via any request parameter; needs live-Core verification before this design's 304 handling can be implemented as anything beyond "currently unreachable."
5. **DIAL Core issue #1633 and children** — unreachable in this environment; if their text conflicts with anything in this design, the design's schema-derived claims should be treated as authoritative per the task's own tie-breaking instruction, but a human should still reconcile the two before implementation starts, in case the issues describe planned-but-unreleased schema changes.

## Risks / Trade-offs

- **[Risk] Pre-release SDK dependency (`dev.N`) could publish a breaking change between this design and implementation.** → Mitigation: Task 1.1 re-verifies the registry immediately before bumping; pin an exact version, never a range; run the full `chat-api` suite (exercises every existing SDK call site) before merge.
- **[Risk] ZIP-based whole-skill upload means the BFF must fully buffer-and-validate a ZIP before forwarding — large skills could pressure memory/CPU.** → Mitigation: `SKILL_UPLOAD_MAX_BYTES`/`SKILL_UPLOAD_MAX_FILES` bound the worst case; validation reuses the already-hardened `files-upload.service.ts` archive-handling code path rather than a new implementation.
- **[Risk] `createSkillGroupingFolder` cannot forward `If-Match` (schema has no request headers) — a caller expecting conditional-create semantics will be surprised.** → Mitigation: documented explicitly in D2 and the `skills-bff-api` spec; no silent best-effort workaround invented.
- **[Risk] Schema debt around `downloadSkillFile`'s declared `'application/json': string` content type for what's actually an arbitrary binary/text file** (`schema.ts:17790-17793` — the response `Content-Type` header is documented as dynamic per-file, but the OpenAPI `content` map key is the literal string `'application/json'`, an apparent authoring mistake in the upstream spec). → Mitigation: the BFF trusts the dynamic `Content-Type` response *header*, not the OpenAPI `content` map key, when forwarding to the browser — documented as upstream schema debt, not silently "fixed" by inventing a different content-type resolution rule.
- **[Risk] Sharing/publication touch points are additive-only in this change — no working end-to-end skill-share or skill-publish flow ships yet** (only DTO allowlist extensions + `SkillsLookupService`). → Mitigation: explicitly scoped as "the minimal changes required" per the task brief; the `skills-bff-api`/`skills-service-decomposition` specs, not this change's sharing/publication deltas, are the primary deliverable; open questions (D8) are flagged rather than papered over.
