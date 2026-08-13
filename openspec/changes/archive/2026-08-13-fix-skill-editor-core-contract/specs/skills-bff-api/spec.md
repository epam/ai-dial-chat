## REMOVED Requirements

### Requirement: Create or replace a whole skill from a ZIP archive
**Reason**: Verified against DIAL Core's actual implementation (`ComplexResourceController`/`EtagHeader`, `epam/ai-dial-core`), Core never accepts a ZIP for whole-skill writes — it requires `multipart/form-data` with one part per file, filename = relative path. This single-endpoint, ZIP-in requirement is replaced by two separate operations (`createSkill`/`updateSkill`, below) using the corrected multipart-not-ZIP contract and the verified `If-None-Match`-based atomic-create mechanism.
**Migration**: Callers of the old `PUT /api/v1/skills` (a single ZIP `file` field) must switch to `POST /api/v1/skills` (create) or `PUT /api/v1/skills` (update, now requiring `If-Match`), both using the `skillManifest`/`filePaths`/`files` multipart shape defined below. No skill was ever successfully created against the old contract (it always failed with `400`), so there is no existing caller or on-disk state to migrate in practice.

## ADDED Requirements

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
