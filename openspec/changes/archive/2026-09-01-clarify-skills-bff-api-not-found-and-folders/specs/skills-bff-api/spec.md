## MODIFIED Requirements

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
- **WHEN** the given `path` holds no grouping folder or skill
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
- **WHEN** the given skill `path` holds no skill
- **THEN** the system returns `404 Not Found`

### Requirement: Download a whole skill as a ZIP
The system SHALL expose `GET /api/v1/skills/download` accepting `bucket` and `path`, proxy to DIAL Core `downloadSkillFolder` (`GET /v2/skills/{bucket}/{path}`), and stream the `application/zip` response back to the browser without buffering the full body. The endpoint SHALL forward only the safe response-header allowlist: `content-type`, `content-disposition`, `etag`.

The endpoint SHALL NOT forward a `content-length` header. Both `downloadSkill` and `downloadSkillFile` stream the DIAL Core response body directly via the SDK's raw `fetch` (`parseAs: 'stream'`) without buffering it, and Node's `fetch` may transparently decode a `Content-Encoding` present on the upstream response — so any `Content-Length` DIAL Core sent may describe the upstream wire size rather than the byte count this BFF actually streams onward. Forwarding it in that case would risk a client-observed length mismatch, so it is omitted rather than forwarded on a best-effort basis.

The system SHALL NOT expose `downloadSkillGroupingFolder` as its own route. When the requested `path` identifies a grouping folder rather than a skill, the endpoint SHALL return `400 Bad Request` with a message directing the caller to `GET /api/v1/skills` for metadata listing, matching DIAL Core's own `downloadSkillGroupingFolder` contract (which defines no `200` response at all — only `400`/`403`/`500`).

The system SHALL NOT forward an `If-None-Match` request header on this operation — the verified DIAL Core schema declares no request header parameters for `downloadSkillFolder`, despite documenting a `304 Not Modified` response.

- **Rate limit**: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.
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
- **WHEN** the given `path` holds no skill
- **THEN** the system returns `404 Not Found`

### Requirement: Download one file from a skill
The system SHALL expose `GET /api/v1/skills/files/download` accepting `bucket`, `path` (skill path), and `filePath` (relative path of the file within the skill), and proxy to DIAL Core `downloadSkillFile` (`GET /v2/skills/{bucket}/{path}/files/{filePath}`). The endpoint SHALL stream the response with the upstream `Content-Type`, forwarding only the safe response-header allowlist: `content-type`, `content-disposition`, `etag`.

The endpoint SHALL NOT forward a `content-length` header, for the same reason given under "Download a whole skill as a ZIP": the response body is streamed unbuffered via the SDK's raw `fetch`, and any upstream `Content-Length` is not guaranteed to match the byte count actually streamed onward once transport-level decoding is possible.

The system SHALL trust the dynamic `Content-Type` **response header** DIAL Core returns for the streamed file, not the OpenAPI schema's `content` map key (which is documented as the literal string `application/json` for this operation regardless of the file's real type — upstream schema debt, not a real content-type constraint).

- **Rate limit**: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.
- **operationId**: `downloadSkillFile`.

#### Scenario: Successful file download
- **WHEN** an authenticated user calls `GET /api/v1/skills/files/download?bucket=my-bucket&path=team-a/docs-helper&filePath=SKILL.md`
- **THEN** the system streams `200 OK` with the file's real `Content-Type` and `ETag` (the skill version's ETag) forwarded, and no `Content-Length` header

#### Scenario: File not found
- **WHEN** the given `filePath` holds no file
- **THEN** the system returns `404 Not Found`

### Requirement: Create a grouping folder
The system SHALL expose `POST /api/v1/skills/grouping-folders` accepting `bucket` and `path`, and proxy to DIAL Core `createSkillGroupingFolder` (`PUT /v2/skills/{bucket}/{path}/`). The endpoint SHALL return `201 Created` with a `SkillGroupingFolderResponseDto { etag }`.

The system SHALL NOT accept or forward an `If-Match` header on this operation — the verified DIAL Core schema declares no request header parameters for `createSkillGroupingFolder`.

When one or more intermediate segments of `path` do not yet exist as grouping folders, the system SHALL create every missing intermediate folder along with the requested one (implicit parent creation), and return `201 Created` with the requested folder's `ETag` — the same outcome as when every intermediate segment already existed.

- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
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
