# skills-bff-api Specification

## Purpose
TBD - created by archiving change add-skills-bff-api. Update Purpose after archive.
## Requirements
### Requirement: List skills and grouping folders
The system SHALL expose `GET /api/v1/skills` accepting `bucket` (required), `path` (optional, default `""`), `token` (optional), `limit` (optional, 0-1000), and `recursive` (optional, default `false`) query parameters, validate all inputs, and proxy to DIAL Core `listSkillMetadata` (`GET /v2/metadata/skills/{bucket}/{path}`) under the authenticated user's session. The endpoint SHALL return `200 OK` with a `SkillListResponseDto`.

- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- **operationId**: `listSkills`.
- **Response DTO**: `SkillListResponseDto { bucket, path, items: SkillMetadataItemDto[], nextToken? }`, mapping DIAL Core's `MetadataBase` (`ResourceFolderMetadata | ResourceItemMetadata`, discriminated by `nodeType: 'FOLDER' | 'ITEM'`) into lowercased `nodeType: 'folder' | 'item'`, mirroring `ListFilesItemDto`'s existing normalization convention (`apps/chat-api/src/files/dto/list-files.dto.ts`).

#### Scenario: List skills at bucket root
- **WHEN** an authenticated user calls `GET /api/v1/skills?bucket=my-bucket`
- **THEN** the system calls DIAL Core `listSkillMetadata` with an empty path and returns `200 OK` with the root-level grouping folders and skills

#### Scenario: List skills recursively
- **WHEN** `GET /api/v1/skills?bucket=my-bucket&path=team-a/&recursive=true` is called
- **THEN** the system forwards `recursive=true` to DIAL Core and returns the whole subtree under `team-a/`

#### Scenario: Pagination token round-trip
- **WHEN** a first page response includes a non-empty `nextToken`
- **AND** the caller repeats the request with `token=<nextToken>`
- **THEN** the response contains the next page of items

#### Scenario: Invalid limit rejected
- **WHEN** `limit` is negative or exceeds `1000`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Grouping folder not found
- **WHEN** DIAL Core returns `404` for the given `path`
- **THEN** the system returns `404 Not Found`

#### Scenario: Unauthenticated request
- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` before calling DIAL Core

### Requirement: List files inside a skill
The system SHALL expose `GET /api/v1/skills/files` accepting `bucket`, `path` (the skill's own resource path), `filePath` (relative path of a subfolder inside the skill to scope the listing — empty string for the skill root), `token`, `limit`, and `recursive` query parameters, and proxy to DIAL Core `listSkillFileMetadata` (`GET /v2/metadata/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL return `200 OK` with a `SkillFileListResponseDto` (same shape as `SkillListResponseDto`, scoped to the skill's own files).

- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- **operationId**: `listSkillFiles`.

#### Scenario: List files at the skill root
- **WHEN** `GET /api/v1/skills/files?bucket=my-bucket&path=team-a/docs-helper&filePath=` is called
- **THEN** the system returns the immediate file entries of the skill, including `SKILL.md`

#### Scenario: Skill not found
- **WHEN** DIAL Core returns `404` for the given skill `path`
- **THEN** the system returns `404 Not Found`

### Requirement: Download a whole skill as a ZIP
The system SHALL expose `GET /api/v1/skills/download` accepting `bucket` and `path`, proxy to DIAL Core `downloadSkillFolder` (`GET /v2/skills/{bucket}/{path}`), and stream the `application/zip` response back to the browser without buffering the full body. The endpoint SHALL forward only the safe response-header allowlist: `content-type`, `content-disposition`, `content-length`, `etag`.

The system SHALL NOT expose `downloadSkillGroupingFolder` as its own route. When the requested `path` identifies a grouping folder rather than a skill, the endpoint SHALL return `400 Bad Request` with a message directing the caller to `GET /api/v1/skills` for metadata listing, matching DIAL Core's own `downloadSkillGroupingFolder` contract (which defines no `200` response at all — only `400`/`403`/`500`).

The system SHALL NOT forward an `If-None-Match` request header on this operation — the verified DIAL Core schema declares no request header parameters for `downloadSkillFolder`, despite documenting a `304 Not Modified` response.

- **Rate limit**: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.
- **operationId**: `downloadSkill`.
- **Streaming**: `Readable.fromWeb`, `pipeline()`, response destruction on pipeline failure, upstream cancellation via `abortOnDisconnect` on client disconnect — following `apps/chat-api/src/files/files.controller.ts:409-435` (`downloadArchive`) and `:597-618` (`downloadFile`).

#### Scenario: Successful whole-skill download
- **WHEN** an authenticated user calls `GET /api/v1/skills/download?bucket=my-bucket&path=team-a/docs-helper`
- **THEN** the system streams a `200 OK` `application/zip` response with the upstream `ETag` and `Content-Length` headers forwarded

#### Scenario: Downloading a grouping folder is rejected
- **WHEN** the requested `path` identifies a grouping folder, not a skill
- **THEN** the system returns `400 Bad Request` with a message directing the caller to list metadata instead, and does not attempt to stream a body

#### Scenario: Skill not found
- **WHEN** DIAL Core returns `404` for the given `path`
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

- **Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })`.
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

- **Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })`.
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

- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
- **operationId**: `deleteSkill`.

#### Scenario: Successful whole-skill deletion
- **WHEN** an authenticated user calls `DELETE /api/v1/skills?bucket=my-bucket&path=team-a/docs-helper`
- **THEN** the system calls DIAL Core `deleteSkillFolder` and returns `200 OK` with `{ success: true }`

#### Scenario: If-Match precondition mismatch
- **WHEN** the supplied `If-Match` does not match the skill's current `ETag`
- **THEN** the system returns `412 Precondition Failed`

#### Scenario: Skill not found
- **WHEN** DIAL Core returns `404` for the given `path`
- **THEN** the system returns `404 Not Found`

### Requirement: Download one file from a skill
The system SHALL expose `GET /api/v1/skills/files/download` accepting `bucket`, `path` (skill path), and `filePath` (relative path of the file within the skill), and proxy to DIAL Core `downloadSkillFile` (`GET /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL stream the response with the upstream `Content-Type`, forwarding only the safe response-header allowlist: `content-type`, `content-disposition`, `content-length`, `etag`.

The system SHALL trust the dynamic `Content-Type` **response header** DIAL Core returns for the streamed file, not the OpenAPI schema's `content` map key (which is documented as the literal string `application/json` for this operation regardless of the file's real type — upstream schema debt, not a real content-type constraint).

- **Rate limit**: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.
- **operationId**: `downloadSkillFile`.

#### Scenario: Successful file download
- **WHEN** an authenticated user calls `GET /api/v1/skills/files/download?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md`
- **THEN** the system streams `200 OK` with the file's real `Content-Type`, `Content-Length`, and `ETag` (the skill version's ETag) forwarded

#### Scenario: File not found
- **WHEN** DIAL Core returns `404` for the given `filePath`
- **THEN** the system returns `404 Not Found`

### Requirement: Add or replace one file in a skill
The system SHALL expose `PUT /api/v1/skills/files` accepting `bucket`, `path`, `filePath`, a single binary `file`, and an optional `If-Match` header, and proxy to DIAL Core `uploadSkillFile` (`PUT /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL return `200 OK` with a `SkillFileUploadResponseDto { etag }` — the new ETag of the whole skill after the file is added/replaced atomically.

`filePath` SHALL be validated against the same reserved-marker and traversal rules as whole-skill upload entries (D4 in design.md): no absolute path, no empty/`.`/`..` segments, no NUL/control characters, not `.dial-resource`/`.dial-folder`, no `files`/`v` first segment.

- **Rate limit**: `@Throttle({ default: { limit: 20, ttl: 60000 } })`.
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

- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
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

- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
- **operationId**: `createSkillGroupingFolder`.

#### Scenario: Successful grouping-folder creation
- **WHEN** an authenticated user calls `POST /api/v1/skills/grouping-folders?bucket=my-bucket&path=team-a/`
- **THEN** the system calls DIAL Core and returns `201 Created` with the folder's `ETag`

#### Scenario: Name collision rejected
- **WHEN** the folder already exists, or a resource/folder name collision is detected
- **THEN** the system returns `400 Bad Request`

#### Scenario: Parent path not found
- **WHEN** DIAL Core returns `404` for the parent path
- **THEN** the system returns `404 Not Found`

### Requirement: Delete an empty grouping folder
The system SHALL expose `DELETE /api/v1/skills/grouping-folders` accepting `bucket`, `path`, and an optional `If-Match` header, and proxy to DIAL Core `deleteSkillGroupingFolder` (`DELETE /v2/skills/{bucket}/{path}/`). The endpoint SHALL return `200 OK` with `{ success: true }`.

- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
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

### Requirement: Rate limiting exceeded
Every `/api/v1/skills/**` endpoint SHALL enforce its documented per-route `@Throttle` limit and return `429 Too Many Requests` when exceeded.

#### Scenario: Rate limit exceeded on any skill endpoint
- **WHEN** a session exceeds the documented request limit for a given skill endpoint within its window
- **THEN** the system returns `429 Too Many Requests`

### Requirement: Upstream failures map to safe, typed statuses
The skills domain SHALL use the shared `handleDialSdkError`/`mapDialHttpStatus` mapper (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) for every DIAL Core call, including the new `405`/`412`/`422` mappings this change adds. No internal Core error payload, access token, multipart body, or file content SHALL appear in logs.

#### Scenario: Unexpected Core 5xx
- **WHEN** DIAL Core returns a 5xx status for any skill operation
- **THEN** the system logs the error (without token/body/content) and returns `502 Bad Gateway`

#### Scenario: Core unreachable or timed out
- **WHEN** a skill operation's upstream call times out or the connection fails
- **THEN** the system returns `503 Service Unavailable`

