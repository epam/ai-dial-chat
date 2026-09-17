# skills-bff-api Specification

## Purpose
TBD - created by archiving change add-skills-bff-api. Update Purpose after archive.
## Requirements
### Requirement: List skills and grouping folders

The system SHALL expose `GET /api/v1/skills` accepting `bucket` (required), `path` (optional, default `""`), `token` (optional), `limit` (optional, 0-1000), and `recursive` (optional, default `false`) query parameters, validate all inputs, and proxy to DIAL Core `listSkillMetadata` (`GET /v2/metadata/skills/{bucket}/{path}`) under the authenticated user's session. The endpoint SHALL return `200 OK` with a `SkillListResponseDto`.

- **operationId**: `listSkills`.
- **Response DTO**: `SkillListResponseDto { bucket, path, items: SkillMetadataItemDto[], nextToken? }`, mapping DIAL Core's `MetadataBase` (`ResourceFolderMetadata | ResourceItemMetadata | ComplexResourceItemMetadata`, discriminated by `nodeType: 'FOLDER' | 'ITEM'`) into lowercased `nodeType: 'folder' | 'item'`, mirroring `ListFilesItemDto`'s existing normalization convention (`apps/chat-api/src/files/dto/list-files.dto.ts`).

Each mapped `SkillMetadataItemDto` for `nodeType: 'item'` SHALL carry `description?: string`, sourced from the upstream item metadata's `attributes` map (DIAL Core PR #1970 — manifest-derived attributes on complex resource items, including recursive listing children). The `attributes` field SHALL be read defensively off the raw upstream item (`'attributes' in item`), since the installed `@epam/ai-dial-typescript-sdk`'s `MetadataBase` schema may not declare it; an absent `attributes` map, or a `description` value that is not a string, SHALL map to `description: undefined` — never throw. Folder entries SHALL NOT carry `description`.

#### Scenario: List skills at bucket root

- **WHEN** an authenticated user calls `GET /api/v1/skills?bucket=my-bucket`
- **THEN** the system calls DIAL Core `listSkillMetadata` with an empty path and returns `200 OK` with the root-level grouping folders and skills

#### Scenario: Item description is forwarded from attributes

- **WHEN** DIAL Core returns a skill item whose `attributes` contains `"description": "Summarizes documents"`
- **THEN** the mapped `SkillMetadataItemDto` in the response carries `description: "Summarizes documents"`

#### Scenario: Item without attributes has no description

- **WHEN** DIAL Core returns a skill item with no `attributes` map (older Core, or an entry Core populates without it)
- **THEN** the mapped item omits `description` (it serializes as absent) and the endpoint still returns `200 OK`

#### Scenario: Non-string description is ignored

- **WHEN** DIAL Core returns a skill item whose `attributes.description` is a number or object
- **THEN** the mapped item omits `description` rather than forwarding the non-string value

#### Scenario: Folder entries never carry a description

- **WHEN** DIAL Core returns a `nodeType: 'FOLDER'` entry that happens to include an `attributes` map
- **THEN** the mapped folder entry omits `description`

#### Scenario: List skills recursively

- **WHEN** `GET /api/v1/skills?bucket=my-bucket&path=team-a/&recursive=true` is called
- **THEN** the system forwards `recursive=true` to DIAL Core and returns the whole subtree under `team-a/`, with each skill item's `description` populated from its `attributes` where Core provides one

#### Scenario: Pagination token round-trip

- **WHEN** a first page response includes a non-empty `nextToken`
- **AND** the caller repeats the request with `token=<nextToken>`
- **THEN** the response contains the next page of items

#### Scenario: Invalid limit rejected

- **WHEN** `limit` is negative or exceeds `1000`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Grouping folder not found

- **WHEN** the given `path` holds no grouping folder or skill
- **THEN** the system returns `404 Not Found`

#### Scenario: Unauthenticated request

- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before calling DIAL Core

### Requirement: Get one skill's own metadata

The system SHALL expose authenticated `GET /api/v1/skills/metadata` accepting
`bucket` (required) and `path` (required) query parameters, validate both,
resolve the single skill resource through DIAL Core `listSkillMetadata`
(`GET /v2/metadata/skills/{bucket}/{path}`) under the caller's own session, and
return `200 OK` with one `SkillMetadataItemDto`.

This endpoint exists because `GET /api/v1/skills` structurally cannot serve it.
`SkillsListingService.listSkills` maps its upstream response through
`mapListing`, which reads `data.items ?? []`; when `path` addresses a skill item
DIAL Core returns that item's own metadata rather than a container with `items`,
so `SkillListResponseDto` answers `items: []` and the requested resource's own
`author` and `updatedAt` never appear in the response — even though the
underlying Core operation returns them (as `SkillsLookupService.resolveSkillItem`
demonstrates on the invitation path).

- **operationId**: `getSkillMetadata`.
- **Request DTO**: the existing `SkillResourceQueryDto`
  (`bucket`: `BUCKET_NAME_PATTERN`, `MaxLength(256)`; `path`:
  `@IsValidFilePath()`, `MaxLength(1024)`). No request body.
- **Response DTO**: `SkillMetadataItemDto`.
- **Rate limiting**: none. `apps/chat-api` declares no `ThrottlerModule` and no
  existing skills endpoint carries `@Throttle`; this endpoint matches its
  siblings. Introducing rate limiting for the skills domain is a separate change.
- **Caching**: none. The response is not cached — no cache key, TTL, or
  invalidation event is introduced, and no per-skill result is memoized
  server-side.
- **Observability**: none beyond the existing `MetricsInterceptor` and the
  service `Logger` already applied to every skills route.
- **Feature gating**: none of its own. It is reachable only from the skill
  details surfaces, which are already gated by the existing Skills feature flag;
  the endpoint itself adds no `ENABLED_FEATURES` key.

The resolution SHALL live on `SkillsListingService` (bound through the
`SkillsService` facade), which already owns every `listSkillMetadata` call, and
SHALL reuse `parseSkillResourceUrl`-equivalent identity handling,
`encodeDialResourcePath` for the path, and `mapToSkillMetadataItem` for
normalization. `SkillsLookupService` SHALL NOT be reused or bound on the facade
for this endpoint: its `resolveSkillItem` folds invitation-granted permissions
into `canEdit`, which is correct for `ShareService.acceptInvitation` and wrong
for a provenance read.

The response SHALL carry provenance and identity only: `name`, `path`, `url`,
`bucket`, `nodeType`, `parentPath`, `permissions` (the resource's own, as Core
reports them), `etag`, `author`, `createdAt`, `updatedAt`, and `description`.
It SHALL omit `isMy`, `canEdit`, and `sharedWithMe` entirely, so fetching
provenance can never grant ownership or editing rights and no invitation-derived
permission can reach it. Ownership and editability remain owned by
`GET /api/v1/skills/catalog`.

The endpoint SHALL resolve against the `bucket` given in the request, never the
caller's session bucket, so a skill owned by another user resolves against the
owner's bucket. DIAL Core enforces access with the caller's own access token.

Status mapping:

- `400` — invalid `bucket` or `path` per DTO validation, or the resolved
  metadata is a `nodeType: folder`. A grouping folder has no skill provenance,
  and returning its fields would render folder metadata as a skill's, so this
  mirrors `downloadSkill`'s existing grouping-folder rule.
- `401` — no valid session cookie, before any upstream call.
- `403` — DIAL Core denies the caller access to the resource.
- `404` — DIAL Core returns 404, or the upstream metadata cannot be normalized
  by `mapToSkillMetadataItem` (missing `bucket`, `name`, or a recognizable
  `nodeType`). Unlike `resolveSkillItem`, which returns `null` so the invitation
  flow can degrade, this endpoint SHALL raise `NotFoundException`.
- `502` / `503` — upstream error response / unavailable or timed out, through
  the existing `handleDialSdkError` mapper.

**Generated-client impact**: the endpoint SHALL appear in
`libs/chat-api-client/openapi.json` with full `@ApiOperation` / `@ApiResponse`
typing (`npm run openapi`, verified by `npm run openapi:check`). Frontend callers
SHALL use the **normal** (non-`Raw`) generated `skillsApi.getSkillMetadata`
method — the response is JSON with no stream or header semantics to preserve —
through the existing singleton in `apps/chat/src/server-api/api-client.ts`, with
a thin wrapper in `apps/chat/src/server-api/skills.api.ts`. No `base.ts` helper
and no direct `fetch` is introduced.

Example request:

```http
GET /api/v1/skills/metadata?bucket=owner-bucket&path=team-a%2Fdocs-helper
Cookie: <session>
```

Example response:

```json
{
  "name": "docs-helper",
  "path": "team-a/docs-helper",
  "url": "skills/owner-bucket/team-a/docs-helper",
  "bucket": "owner-bucket",
  "nodeType": "item",
  "parentPath": "team-a/",
  "permissions": ["READ"],
  "etag": "\"a1b2c3\"",
  "author": "jane.doe@example.com",
  "createdAt": 1749000000000,
  "updatedAt": 1752100000000,
  "description": "Explains our docs"
}
```

#### Scenario: Metadata for a skill in the caller's own bucket

- **WHEN** an authenticated caller requests
  `GET /api/v1/skills/metadata?bucket=my-bucket&path=docs-helper`
- **THEN** the system calls DIAL Core `listSkillMetadata` with the encoded path
  and returns `200 OK` with that skill's `author`, `updatedAt`, `createdAt`,
  `etag`, and `permissions`

#### Scenario: Metadata for a skill owned by another user

- **WHEN** the caller requests
  `bucket=owner-bucket&path=team-a/docs-helper` for a skill shared with them
- **THEN** the lookup is issued against `owner-bucket`, not the caller's session
  bucket, and the response's `url` is `skills/owner-bucket/team-a/docs-helper`

#### Scenario: Nested and encoded paths round-trip

- **WHEN** the requested `path` contains nested segments or characters requiring
  percent-encoding
- **THEN** the path is encoded with `encodeDialResourcePath` before the SDK call
  and the returned `path`/`url` describe the same resource that was requested

#### Scenario: Ownership fields are never returned

- **WHEN** any caller receives a `200 OK` from this endpoint
- **THEN** the payload contains no `isMy`, `canEdit`, or `sharedWithMe` field,
  regardless of who owns the skill or what permissions they hold

#### Scenario: Read-only shared skill stays read-only

- **WHEN** a caller with `READ` only fetches metadata for a skill shared with
  them
- **THEN** the response's `permissions` array reflects `READ` only and no
  WRITE-implying field is present, so calling this endpoint cannot make the
  skill appear editable

#### Scenario: Grouping folder path rejected

- **WHEN** the requested `path` resolves to a `nodeType: FOLDER` upstream
- **THEN** the system returns `400 Bad Request` rather than folder metadata

#### Scenario: Unknown skill

- **WHEN** DIAL Core returns `404` for the requested bucket/path
- **THEN** the system returns `404 Not Found`

#### Scenario: Unnormalizable upstream metadata

- **WHEN** DIAL Core returns metadata with no recognizable `nodeType`, or with
  no `bucket` or `name`
- **THEN** the system returns `404 Not Found` rather than a partially populated
  `200`

#### Scenario: Invalid path rejected before any upstream call

- **WHEN** `path` fails `IsValidFilePath` validation, or `bucket` fails the
  bucket-name pattern
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Unauthenticated request

- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before calling DIAL Core

#### Scenario: Access denied upstream

- **WHEN** DIAL Core rejects the caller's token for the resource
- **THEN** the system returns `403 Forbidden`

#### Scenario: Upstream failure maps to a typed status

- **WHEN** DIAL Core returns a `5xx`, or the call times out
- **THEN** `handleDialSdkError` maps it to `502 Bad Gateway` or
  `503 Service Unavailable` and the upstream body is not leaked

### Requirement: List files inside a skill
The system SHALL expose `GET /api/v1/skills/files` accepting `bucket`, `path` (the skill's own resource path), `filePath` (relative path of a subfolder inside the skill to scope the listing — empty string for the skill root), `token`, `limit`, and `recursive` query parameters, and proxy to DIAL Core `listSkillFileMetadata` (`GET /v2/metadata/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL return `200 OK` with a `SkillFileListResponseDto` (same shape as `SkillListResponseDto`, scoped to the skill's own files).

- **operationId**: `listSkillFiles`.

#### Scenario: List files at the skill root
- **WHEN** `GET /api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=` is called
- **THEN** the system returns the immediate file entries of the skill, including `SKILL.md`

#### Scenario: Skill not found
- **WHEN** the given skill `path` holds no skill
- **THEN** the system returns `404 Not Found`

### Requirement: Download a whole skill as a ZIP
The system SHALL expose `GET /api/v1/skills/download` accepting `bucket` and `path`, proxy to DIAL Core `downloadSkillFolder` (`GET /v2/skills/{bucket}/{path}`), and stream the `application/zip` response back to the browser without buffering the full body. The endpoint SHALL forward only the safe response-header allowlist: `content-type`, `content-disposition`, `etag`.

The endpoint SHALL NOT forward a `content-length` header. Both `downloadSkill` and `downloadSkillFile` stream the DIAL Core response body directly via the SDK's raw `fetch` (`parseAs: 'stream'`) without buffering it, and Node's `fetch` may transparently decode a `Content-Encoding` present on the upstream response — so any `Content-Length` DIAL Core sent may describe the upstream wire size rather than the byte count this BFF actually streams onward. Forwarding it in that case would risk a client-observed length mismatch, so it is omitted rather than forwarded on a best-effort basis.

The system SHALL NOT expose `downloadSkillGroupingFolder` as its own route. When the requested `path` identifies a grouping folder rather than a skill, the endpoint SHALL return `400 Bad Request` with a message directing the caller to `GET /api/v1/skills` for metadata listing, matching DIAL Core's own `downloadSkillGroupingFolder` contract (which defines no `200` response at all — only `400`/`403`/`500`).

The system SHALL NOT forward an `If-None-Match` request header on this operation — the verified DIAL Core schema declares no request header parameters for `downloadSkillFolder`, despite documenting a `304 Not Modified` response.

- **operationId**: `downloadSkill`.
- **Streaming**: `Readable.fromWeb`, `pipeline()`, response destruction on pipeline failure, upstream cancellation via `abortOnDisconnect` on client disconnect — following `apps/chat-api/src/files/files.controller.ts:409-435` (`downloadArchive`) and `:597-618` (`downloadFile`).

#### Scenario: Successful whole-skill download
- **WHEN** an authenticated user calls `GET /api/v1/skills/download?bucket=my-bucket&path=team-a/docs-helper`
- **THEN** the system streams a `200 OK` `application/zip` response with the upstream `ETag` forwarded, and no `Content-Length` header

#### Scenario: Downloading a grouping folder is rejected
- **WHEN** the requested `path` identifies a grouping folder, not a skill
- **THEN** the system returns `400 Bad Request` with a message directing the caller to list metadata instead, and does not attempt to stream a body

#### Scenario: Skill not found
- **WHEN** the given `path` holds no skill
- **THEN** the system returns `404 Not Found`

#### Scenario: Client disconnects mid-download
- **WHEN** the browser closes the connection before the ZIP stream completes
- **THEN** the BFF aborts the upstream DIAL Core request via `abortOnDisconnect` and does not continue reading or buffering the remaining stream

#### Scenario: DIAL Core returns 405
- **WHEN** DIAL Core returns `405 Method Not Allowed` for the requested resource kind
- **THEN** the system returns `405 Method Not Allowed`

#### Scenario: DIAL Core returns 422
- **WHEN** DIAL Core returns `422 Unprocessable Entity`
- **THEN** the system returns `422 Unprocessable Entity`

### Requirement: Create a new skill atomically
The system SHALL expose `POST /api/v1/skills` (`operationId: createSkill`) accepting `bucket`, `path`, `skillManifest` (the complete `SKILL.md` text), `filePaths` (a JSON-encoded array of supporting-file relative paths), and zero or more repeated `files` binary parts paired 1:1 by array index with `filePaths`. The system SHALL send `If-None-Match: '*'` to DIAL Core's `uploadSkillFolder` (`PUT /v2/skills/{bucket}/{path}`) and SHALL NOT send `If-Match`. On success, it SHALL return `201 Created` with a `SkillWriteResponseDto { etag }`.

When DIAL Core responds `412 Precondition Failed` to this create request (its real signal, per `EtagHeader.validateIfNoneMatch`, that a resource already exists at the target path), the system SHALL return `409 Conflict`, not `412`.

Before forwarding to DIAL Core, the system SHALL validate the request per the `skills-multipart-processing` capability (`filePaths`/`files` parity, path safety, `SKILL.md` collision, duplicates, file-count/size/total-size limits against real received bytes) and SHALL NOT construct or forward a ZIP at any point.

- **operationId**: `createSkill`.

#### Scenario: Successful create
- **WHEN** an authenticated user submits a valid `skillManifest` plus supporting files to a new skill path
- **THEN** the system sends `If-None-Match: '*'` to DIAL Core, and on success returns `201 Created` with the new `ETag`

#### Scenario: Create collision maps to 409
- **WHEN** DIAL Core responds `412 Precondition Failed` because a skill already exists at the target path
- **THEN** the system returns `409 Conflict`, not `412`

#### Scenario: Missing SKILL.md content rejected
- **WHEN** `skillManifest` is empty or absent
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: DIAL Core rejects invalid SKILL.md frontmatter
- **WHEN** DIAL Core's own frontmatter validation of `skillManifest` (parsed as `SKILL.md`) fails — e.g. missing `name`/`description` or unparseable YAML
- **THEN** DIAL Core returns `400 Bad Request` with a descriptive message, and the system returns `400 Bad Request` carrying that same message

#### Scenario: Create transfer times out
- **WHEN** the upstream call to DIAL Core exceeds `SKILL_TRANSFER_TIMEOUT_MS`
- **THEN** the system returns `503 Service Unavailable`

### Requirement: Update an existing skill, requiring a concrete If-Match
The system SHALL expose `PUT /api/v1/skills` (`operationId: updateSkill`) accepting the same `bucket`/`path`/`skillManifest`/`filePaths`/`files` shape as `createSkill`, plus a **required** `If-Match` request header carrying the skill's current concrete `ETag`. If `If-Match` is absent, the system SHALL return `428 Precondition Required` without calling DIAL Core — this is a BFF-only safety rail (DIAL Core itself would treat a request with neither conditional header as an unconditional overwrite; the BFF never sends such a request through this endpoint). If `If-Match` is present, the system SHALL forward it unchanged to DIAL Core's `uploadSkillFolder` and SHALL NOT send `If-None-Match`. On success, it SHALL return `200 OK` with a `SkillWriteResponseDto { etag }` — the new aggregate ETag.

A DIAL Core `412 Precondition Failed` response (the supplied `If-Match` no longer matches the skill's current version) SHALL be surfaced unchanged as `412 Precondition Failed`.

- **operationId**: `updateSkill`.

#### Scenario: Successful update
- **WHEN** an authenticated user submits `If-Match: "<current-etag>"` matching the skill's current version, with valid `skillManifest`/supporting files
- **THEN** the system forwards the request and header to DIAL Core, which replaces the skill, and the response is `200 OK` with the new `ETag`

#### Scenario: Missing If-Match rejected before calling Core
- **WHEN** a `PUT /api/v1/skills` request carries no `If-Match` header
- **THEN** the system returns `428 Precondition Required` and does not call DIAL Core

#### Scenario: Stale If-Match stays 412
- **WHEN** the supplied `If-Match` does not match the skill's current `ETag`
- **THEN** DIAL Core returns `412 Precondition Failed` and the system returns `412 Precondition Failed` unchanged

### Requirement: Whole-skill write limits match DIAL Core's real defaults
The system SHALL enforce, before calling DIAL Core, the same limits DIAL Core itself enforces (`ComplexResourceService.Settings`, verified in source): at most 100 files total (manifest included), at most 1 MiB per file, at most 16 MiB total content across all files — using the same status codes Core itself uses for these cases (`400` for file-count exceeded, `413` for any per-file or total-size limit exceeded), configurable via validated `EnvironmentVariables` fields with these exact defaults.

The system SHALL NOT rely on the previous `SKILL_UPLOAD_MAX_BYTES` (a compressed-ZIP-ingress Multer limit) for any of these checks — it has no remaining meaning once no ZIP is ever uploaded, and is retired.

#### Scenario: File-count limit maps to 400, matching Core
- **WHEN** the manifest plus supporting files together exceed the configured file-count limit
- **THEN** the system returns `400 Bad Request`

#### Scenario: Size limit maps to 413, matching Core
- **WHEN** any single file or the total content exceeds its configured byte limit
- **THEN** the system returns `413 Payload Too Large`

### Requirement: Delete a whole skill
The system SHALL expose `DELETE /api/v1/skills` accepting `bucket`, `path`, and an optional `If-Match` header, and proxy to DIAL Core `deleteSkillFolder` (`DELETE /v2/skills/{bucket}/{path}`). The endpoint SHALL return `200 OK` with `{ success: true }`.

- **operationId**: `deleteSkill`.

#### Scenario: Successful whole-skill deletion
- **WHEN** an authenticated user calls `DELETE /api/v1/skills?bucket=my-bucket&path=team-a/docs-helper`
- **THEN** the system calls DIAL Core `deleteSkillFolder` and returns `200 OK` with `{ success: true }`

#### Scenario: If-Match precondition mismatch
- **WHEN** the supplied `If-Match` does not match the skill's current `ETag`
- **THEN** the system returns `412 Precondition Failed`

#### Scenario: Skill not found
- **WHEN** the given `path` holds no skill
- **THEN** the system returns `404 Not Found`

### Requirement: Download one file from a skill
The system SHALL expose `GET /api/v1/skills/files/download` accepting `bucket`, `path` (skill path), and `filePath` (relative path of the file within the skill), and proxy to DIAL Core `downloadSkillFile` (`GET /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL stream the response with the upstream `Content-Type`, forwarding only the safe response-header allowlist: `content-type`, `content-disposition`, `etag`.

The endpoint SHALL NOT forward a `content-length` header, for the same reason given under "Download a whole skill as a ZIP": the response body is streamed unbuffered via the SDK's raw `fetch`, and any upstream `Content-Length` is not guaranteed to match the byte count actually streamed onward once transport-level decoding is possible.

The system SHALL trust the dynamic `Content-Type` **response header** DIAL Core returns for the streamed file, not the OpenAPI schema's `content` map key (which is documented as the literal string `application/json` for this operation regardless of the file's real type — upstream schema debt, not a real content-type constraint).

- **operationId**: `downloadSkillFile`.

#### Scenario: Successful file download
- **WHEN** an authenticated user calls `GET /api/v1/skills/files/download?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md`
- **THEN** the system streams `200 OK` with the file's real `Content-Type` and `ETag` (the skill version's ETag) forwarded, and no `Content-Length` header

#### Scenario: File not found
- **WHEN** the given `filePath` holds no file
- **THEN** the system returns `404 Not Found`

### Requirement: Add or replace one file in a skill
The system SHALL expose `PUT /api/v1/skills/files` accepting `bucket`, `path`, `filePath`, a single binary `file`, and an optional `If-Match` header, and proxy to DIAL Core `uploadSkillFile` (`PUT /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL return `200 OK` with a `SkillFileUploadResponseDto { etag }` — the new ETag of the whole skill after the file is added/replaced atomically.

`filePath` SHALL be validated against the same reserved-marker and traversal rules as whole-skill upload entries (D4 in design.md): no absolute path, no empty/`.`/`..` segments, no NUL/control characters, not `.dial-resource`/`.dial-folder`, no `files`/`v` first segment.

- **operationId**: `uploadSkillFile`.

#### Scenario: Successful single-file add
- **WHEN** an authenticated user uploads a new file to a path not yet present in the skill
- **THEN** the system forwards it to DIAL Core and returns `200 OK` with the skill's new `ETag`

#### Scenario: Invalid filePath rejected
- **WHEN** `filePath` contains a `..` segment, is `.dial-resource`, or starts with a `files`/`v` segment
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: If-Match precondition mismatch
- **WHEN** the supplied `If-Match` does not match the skill's current ETag
- **THEN** the system returns `412 Precondition Failed`

### Requirement: Delete one file from a skill
The system SHALL expose `DELETE /api/v1/skills/files` accepting `bucket`, `path`, `filePath`, and an optional `If-Match` header, and proxy to DIAL Core `deleteSkillFile` (`DELETE /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL return `200 OK` with a `SkillFileDeleteResponseDto { etag }` — the skill's new ETag after the file is removed atomically.

The system SHALL reject deletion of `SKILL.md` with `400 Bad Request` before calling DIAL Core — `SKILL.md` is required for a skill to remain valid and MUST NOT be removable via the single-file-delete path.

- **operationId**: `deleteSkillFile`.

#### Scenario: Successful file deletion
- **WHEN** an authenticated user deletes a non-`SKILL.md` file from a skill
- **THEN** the system calls DIAL Core and returns `200 OK` with the skill's new `ETag`

#### Scenario: Deleting SKILL.md is rejected
- **WHEN** `filePath` resolves to `SKILL.md`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: If-Match precondition mismatch
- **WHEN** the supplied `If-Match` does not match the skill's current ETag
- **THEN** the system returns `412 Precondition Failed`

### Requirement: Create a grouping folder
The system SHALL expose `POST /api/v1/skills/grouping-folders` accepting `bucket` and `path`, and proxy to DIAL Core `createSkillGroupingFolder` (`PUT /v2/skills/{bucket}/{path}/`). The endpoint SHALL return `201 Created` with a `SkillGroupingFolderResponseDto { etag }`.

The system SHALL NOT accept or forward an `If-Match` header on this operation — the verified DIAL Core schema declares no request header parameters for `createSkillGroupingFolder`.

When one or more intermediate segments of `path` do not yet exist as grouping folders, the system SHALL create every missing intermediate folder along with the requested one (implicit parent creation), and return `201 Created` with the requested folder's `ETag` — the same outcome as when every intermediate segment already existed.

- **operationId**: `createSkillGroupingFolder`.

#### Scenario: Successful grouping-folder creation
- **WHEN** an authenticated user calls `POST /api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a`
- **THEN** the system calls DIAL Core and returns `201 Created` with the folder's `ETag`

#### Scenario: Name collision rejected
- **WHEN** the folder already exists, or a resource/folder name collision is detected
- **THEN** the system returns `400 Bad Request`

#### Scenario: Missing intermediate parents are created implicitly
- **WHEN** an authenticated user calls `POST /api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/sub-team/project` and neither `team-a` nor `team-a/sub-team` exists yet
- **THEN** the system creates `team-a`, `team-a/sub-team`, and `team-a/sub-team/project`, and returns `201 Created` with the requested folder's `ETag`

### Requirement: Delete an empty grouping folder
The system SHALL expose `DELETE /api/v1/skills/grouping-folders` accepting `bucket`, `path`, and an optional `If-Match` header, and proxy to DIAL Core `deleteSkillGroupingFolder` (`DELETE /v2/skills/{bucket}/{path}/`). The endpoint SHALL return `200 OK` with `{ success: true }`.

- **operationId**: `deleteSkillGroupingFolder`.

#### Scenario: Successful deletion of an empty grouping folder
- **WHEN** an authenticated user deletes a grouping folder with no skills or sub-folders inside it
- **THEN** the system calls DIAL Core and returns `200 OK` with `{ success: true }`

#### Scenario: Non-empty grouping folder rejected
- **WHEN** the grouping folder still contains skills or sub-folders
- **THEN** DIAL Core returns `409 Conflict` and the system returns `409 Conflict`

#### Scenario: If-Match precondition mismatch
- **WHEN** the supplied `If-Match` does not match the folder's current state
- **THEN** the system returns `412 Precondition Failed`

#### Scenario: Grouping folder not found
- **WHEN** DIAL Core returns `404` for the given `path`
- **THEN** the system returns `404 Not Found`

### Requirement: All skill endpoints require authentication
Every `/api/v1/skills/**` endpoint SHALL require a valid session; a request with no valid session cookie SHALL return `401 Unauthorized` before any DIAL Core call is made. DIAL Core remains the sole authorizer of bucket/skill/file access via the forwarded session bearer token — the BFF makes no additional role or permission decisions.

#### Scenario: Unauthenticated request to any skill endpoint
- **WHEN** a request to any `/api/v1/skills/**` route carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` and does not forward the request to DIAL Core

### Requirement: Upstream failures map to safe, typed statuses
The skills domain SHALL use the shared `handleDialSdkError`/`mapDialHttpStatus` mapper (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) for every DIAL Core call, including the new `405`/`412`/`422` mappings this change adds. No internal Core error payload, access token, multipart body, or file content SHALL appear in logs.

#### Scenario: Unexpected Core 5xx
- **WHEN** DIAL Core returns a 5xx status for any skill operation
- **THEN** the system logs the error (without token/body/content) and returns `502 Bad Gateway`

#### Scenario: Core unreachable or timed out
- **WHEN** a skill operation's upstream call times out or the connection fails
- **THEN** the system returns `503 Service Unavailable`

---

### Requirement: Aggregate catalog skills

The system SHALL expose authenticated `GET /api/v1/skills/catalog` with `operationId: listCatalogSkills`. The endpoint accepts no bucket query: it obtains the caller's bucket and access token from the session. It returns `SkillCatalogListResponseDto`:

```json
{
  "skills": [],
  "sharedWithMe": [],
  "publicSkills": []
}
```

`SkillsListingService` SHALL recursively follow every `nextToken` for the caller and `public` buckets, reject a repeated token rather than loop forever, filter grouping folders from the arrays, and fetch resources shared with the caller through `getSharedResources({ resourceTypes: ['SKILL'], with: 'me' })`.

Each `SkillMetadataItemDto` SHALL expose optional `isMy`, `canEdit`, and `sharedWithMe` flags. Personal skills are owned and editable. Shared skills are editable only when their shared-resource permissions include `WRITE`; their full `skills/{ownerBucket}/{path}` URL SHALL be preserved. For `nodeType: ITEM`, the BFF SHALL canonicalize that URL from `bucket`, `parentPath`, and `name` without a trailing slash, rather than trusting a folder-shaped upstream `url`. Joining `parentPath` and `name` SHALL insert exactly one `/` whether or not Core includes a trailing separator in `parentPath`. Organisation skills are always `isMy: false`, `canEdit: false`, and `sharedWithMe: false`, regardless of upstream metadata. Shared items already present in the personal or organisation arrays SHALL be deduplicated by canonical full URL.

Each skill item SHALL carry `description?: string` sourced from the upstream item's `attributes.description` under the same defensive rules as the bucket listing: absent map or non-string value → omitted; folders never carry it; a namespace whose upstream payload lacks `attributes` (notably the shared-with-me path, whose `getSharedResources` coverage for `attributes` is unverified) degrades to items with no description rather than failing.

Personal and organisation listings SHALL settle independently. If one rejects, the endpoint returns the other namespace and logs a warning; if both reject, it propagates the upstream error. Shared-resource failure degrades to an empty `sharedWithMe` array. The endpoint returns `401` without a session and maps upstream failures through the existing skills error mapper.

#### Scenario: One request returns personal, shared, and public skills

- **WHEN** an authenticated caller requests `GET /api/v1/skills/catalog`
- **THEN** the response contains all three arrays and the browser needs no bucket-specific list request

#### Scenario: Catalog item descriptions come from the listing

- **WHEN** a personal skill's upstream metadata carries `attributes.description`
- **THEN** the corresponding item in the response's `skills` array carries that `description`, with no per-skill file download involved

#### Scenario: Shared skills without attributes degrade silently

- **WHEN** the shared-resources upstream payload carries no `attributes` maps
- **THEN** the `sharedWithMe` items simply omit `description` and the endpoint returns `200 OK`

#### Scenario: Writable shared skill keeps its owner URL

- **WHEN** a shared resource is `skills/owner-bucket/team-a/docs-helper` with `READ` and `WRITE`
- **THEN** it appears in `sharedWithMe` with `canEdit: true`, `sharedWithMe: true`, and that full URL

#### Scenario: Folder-shaped item URL is canonicalized before editing

- **WHEN** Core returns an item named `docs-helper` under `team-a/` with upstream URL `skills/owner-bucket/team-a/docs-helper/`
- **THEN** the aggregate DTO contains `path: 'team-a/docs-helper'` and `url: 'skills/owner-bucket/team-a/docs-helper'`
- **AND** opening Edit never calls the skill download endpoint with a path ending in `/`

#### Scenario: File metadata parent path has no trailing separator

- **WHEN** Core returns `parentPath: 'docs-helper/files'` and `name: 'SKILL.md'`
- **THEN** the BFF returns `path: 'docs-helper/files/SKILL.md'`, not `docs-helper/filesSKILL.md`

