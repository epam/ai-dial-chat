# skill-archive-import Specification

## Purpose
Specifies the Catalog "Upload" entry point and the `POST /api/v1/skills/import` BFF endpoint that let a user create a whole Skill from a single ZIP archive: server-side extraction and validation, atomic creation via the existing multipart Skill contract, and the frontend workflow that wires file selection to the API call and Catalog refresh.

## Requirements

### Requirement: Catalog "Upload" entry imports a Skill archive

The Catalog Create dropdown's "Upload" entry (child of the "Skill" submenu, see `catalog-create-options`) SHALL open a native file picker restricted to a single ZIP archive, upload the selected file to the BFF's import endpoint, and — on success — refresh `SkillsContext` so the newly created Skill appears in the Catalog without a manual page reload.

#### Scenario: Selecting a valid archive creates a Skill and refreshes the Catalog
- **WHEN** a user selects a well-formed Skill ZIP archive through the "Upload" file picker
- **THEN** the archive is uploaded, a Skill is created, `SkillsContext.refetchSkills()` is called, and the new Skill appears in the Catalog

#### Scenario: Re-selecting the same file re-triggers the upload
- **WHEN** a user selects the same file a second time immediately after a prior selection
- **THEN** the hidden file input's value is reset after the first selection so the native `onChange` event fires again and the upload is re-attempted

#### Scenario: A second upload cannot start while one is in progress
- **WHEN** a user triggers "Upload" while a previous archive import for this user is still in flight
- **THEN** the file picker or submission is prevented from starting a second concurrent import

### Requirement: `POST /api/v1/skills/import` accepts one ZIP archive and creates a Skill atomically

The system SHALL expose `POST /api/v1/skills/import` (`operationId: importSkillArchive`) on the existing versioned Skills controller. The endpoint SHALL accept `multipart/form-data` with one required binary field `file`, use the authenticated user's bucket from `req.user.bucket` (never a client-supplied bucket), and — after full validation succeeds — perform exactly one atomic whole-Skill create against DIAL Core via the existing `uploadSkillFolder` call with `If-None-Match: *`, reusing the same Core-facing behavior `POST /api/v1/skills` already uses.

On success the endpoint SHALL respond `201 Created` with `name`, `path`, `url`, and `etag` fields describing the newly created Skill.

The endpoint SHALL be rate-limited identically to the existing create endpoint (`@Throttle({ default: { limit: 5, ttl: 60000 } })`) and SHALL NOT define or use any response cache.

#### Scenario: Valid archive is imported successfully
- **WHEN** an authenticated user POSTs a well-formed Skill ZIP to `/api/v1/skills/import`
- **THEN** the response is `201 Created` with `name`, `path`, `url`, and `etag` fields describing the newly created Skill

#### Scenario: Client-supplied bucket is ignored
- **WHEN** a request includes any bucket value in its body or query string
- **THEN** the server uses only the authenticated user's own bucket from the session and ignores any client-supplied value

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request to `/api/v1/skills/import` has no valid session
- **THEN** the response is `401 Unauthorized` and no extraction or Core call is attempted

#### Scenario: Rate limit is enforced
- **WHEN** a user exceeds 5 import requests within 60 seconds
- **THEN** the 6th request within that window is rejected with `429 Too Many Requests`

### Requirement: Import is all-or-nothing — validation failure makes zero Core calls

The system SHALL fully receive, extract, and validate the archive before making any call to DIAL Core. Any validation failure at any stage (container, structure, path safety, size limits, manifest content) SHALL result in zero calls to `uploadSkillFolder` and SHALL leave no partially created Skill.

A successful import SHALL make exactly one `uploadSkillFolder` call carrying the complete, validated set of files.

#### Scenario: Validation failure makes no Core call
- **WHEN** an uploaded archive fails any validation check
- **THEN** the DIAL Core client's `uploadSkillFolder` method is never invoked for that request

#### Scenario: Success performs exactly one Core call
- **WHEN** an uploaded archive passes all validation checks
- **THEN** exactly one `uploadSkillFolder` call is made, carrying the manifest and every supporting file from the archive in a single multipart request

#### Scenario: A collision maps to 409 without a partial write
- **WHEN** a Skill already exists at the path derived from the archive's manifest `name`
- **THEN** DIAL Core's `412` response is mapped to `409 Conflict`, no existing Skill is modified, and no partial Skill is created

### Requirement: Archive container and structure validation

The system SHALL reject, before extracting any file content, an archive that is: missing, empty, not a ZIP by signature (not merely by file extension or declared MIME type), truncated, or otherwise corrupted (`400`).

After a successful open, the system SHALL enforce an entry-count ceiling read from the archive's central directory metadata alone, before extracting any entry's bytes (`422` if exceeded).

The system SHALL ignore OS-added metadata noise before any structural validation: macOS's `__MACOSX/` resource-fork tree and any `.DS_Store` or `Thumbs.db` entry, at any nesting depth, are skipped entirely — like a directory entry — and never count toward the wrapper-directory, manifest, or duplicate-path checks below.

The system SHALL determine the normalized set of relative paths as follows: if every entry shares one identical first path segment (and that segment is not `SKILL.md` itself), that segment is treated as an optional wrapper directory and stripped from every path before further validation; otherwise, no stripping occurs. After this normalization step, the archive SHALL contain exactly one entry whose path is exactly `SKILL.md` (case-sensitive) — zero such entries is `400`, more than one is `422`. The system SHALL reject duplicate normalized paths (`422`) and SHALL treat directory entries as directories, never as zero-byte files.

#### Scenario: Non-ZIP file is rejected
- **WHEN** a file without a valid ZIP local-file-header signature is uploaded, regardless of its filename extension or declared content type
- **THEN** the response is `400 Bad Request`

#### Scenario: Corrupted archive is rejected
- **WHEN** a truncated or corrupted ZIP is uploaded
- **THEN** the response is `400 Bad Request` and no partial extraction result is used

#### Scenario: Archive with too many entries is rejected before extraction
- **WHEN** an archive's central directory lists an entry count above the configured ceiling
- **THEN** the response is `422 Unprocessable Entity` and no entry's content is read

#### Scenario: A single common wrapper directory is stripped
- **WHEN** every entry in the archive is nested under one identical top-level directory, e.g. `docs-helper/SKILL.md` and `docs-helper/scripts/run.sh`
- **THEN** that directory is stripped and the Skill is created from `SKILL.md` and `scripts/run.sh`

#### Scenario: A macOS Finder-created archive imports successfully
- **WHEN** a user uploads a ZIP that Finder's "Compress" produced from a folder — containing the real `<name>/SKILL.md` content alongside a sibling `__MACOSX/<name>/._SKILL.md` resource-fork tree
- **THEN** the `__MACOSX` entries are ignored, the wrapper directory is stripped from the remaining entries, and the Skill is created normally

#### Scenario: Archive with no manifest is rejected
- **WHEN** neither the raw nor the wrapper-stripped path set contains a `SKILL.md` entry
- **THEN** the response is `400 Bad Request`

#### Scenario: Archive with multiple Skills is rejected
- **WHEN** an archive normalizes to more than one entry whose path is `SKILL.md` (e.g. two differently named top-level directories, each containing its own `SKILL.md`)
- **THEN** the response is `422 Unprocessable Entity` and no Skill is created

#### Scenario: Duplicate normalized paths are rejected
- **WHEN** two archive entries normalize to the same relative path after any wrapper stripping
- **THEN** the response is `422 Unprocessable Entity`

#### Scenario: Directory entries are not counted as files
- **WHEN** an archive contains explicit directory entries alongside file entries
- **THEN** the directory entries are excluded from the file count and from the created Skill's files

### Requirement: Entry-level safety rules reuse the existing Skill path contract

Every extracted, normalized entry path SHALL be validated against the same relative-path safety rules the existing Skill multipart create endpoint enforces: no absolute path, no drive letter, no backslash, no empty/`.`/`..` segment, no control or NUL characters, no `.dial-resource` or `.dial-folder` segment, and no reserved first segment such as `files` or `v`. A path failing any of these rules SHALL be rejected (`400`).

The system SHALL reject, per entry, before decompressing its content: encrypted entries, symbolic-link entries, and any entry that is neither a regular file nor a directory.

#### Scenario: Path traversal is rejected
- **WHEN** an archive entry's path contains a `..` segment or an absolute path
- **THEN** the response is `400 Bad Request` and no file is written

#### Scenario: Encrypted entry is rejected
- **WHEN** an archive contains a password-protected (encrypted) entry
- **THEN** the response is `422 Unprocessable Entity` and no Skill is created

#### Scenario: Symbolic link entry is rejected
- **WHEN** an archive contains an entry whose Unix external file attributes mark it as a symbolic link
- **THEN** the response is `422 Unprocessable Entity` and no Skill is created

### Requirement: Decompressed-content limits are enforced incrementally, not from ZIP metadata

The system SHALL enforce the existing Skill content limits — maximum 100 files including `SKILL.md`, maximum 1 MiB per file, maximum 16 MiB total uncompressed content — against bytes actually produced while decompressing each entry, aborting the read as soon as a limit is exceeded. The system SHALL NOT rely on a ZIP entry's declared uncompressed-size metadata alone to make this determination.

The system SHALL additionally enforce a separate, configurable compressed-ingress limit (`SKILL_ARCHIVE_UPLOAD_MAX_BYTES`) on the archive file as received, before extraction begins.

#### Scenario: Oversized compressed upload is rejected before extraction
- **WHEN** an uploaded archive's size exceeds `SKILL_ARCHIVE_UPLOAD_MAX_BYTES`
- **THEN** the response is `413 Payload Too Large` and no extraction is attempted

#### Scenario: A file count above the limit is rejected
- **WHEN** an archive's normalized file set (including `SKILL.md`) exceeds 100 files
- **THEN** the response is `400 Bad Request`

#### Scenario: A single oversized file is rejected during decompression
- **WHEN** decompressing one entry produces more than 1 MiB of content, regardless of the entry's declared compressed or uncompressed size
- **THEN** decompression of that entry is aborted and the response is `413 Payload Too Large`

#### Scenario: Total uncompressed content above the limit is rejected during decompression
- **WHEN** the running total of decompressed bytes across all entries exceeds 16 MiB
- **THEN** extraction is aborted and the response is `413 Payload Too Large`

### Requirement: Manifest content validation

The system SHALL decode the archive's `SKILL.md` entry as strict UTF-8, rejecting (`400`) any byte sequence that is not valid UTF-8. The system SHALL parse the manifest's YAML frontmatter and require non-empty string `name` and `description` fields, rejecting (`400`) a manifest with missing frontmatter, malformed YAML, or an empty or non-string `name` or `description`.

The system SHALL derive the destination Skill path from the manifest's `name` field using the same path-safety contract the manual Skill-creation flow already applies to a Skill's destination path. The system SHALL NOT rewrite or otherwise modify the uploaded `SKILL.md` content; only the destination path is computed from `name`.

#### Scenario: Invalid UTF-8 manifest is rejected
- **WHEN** the archive's `SKILL.md` entry contains a byte sequence that is not valid UTF-8
- **THEN** the response is `400 Bad Request`

#### Scenario: Missing or invalid frontmatter is rejected
- **WHEN** `SKILL.md`'s YAML frontmatter is missing, malformed, or has an empty or non-string `name` or `description`
- **THEN** the response is `400 Bad Request`

#### Scenario: Manifest content is stored unmodified
- **WHEN** a valid archive is imported
- **THEN** the created Skill's `SKILL.md` content is byte-for-byte identical to the archive's `SKILL.md` entry

### Requirement: Resource cleanup on every outcome

The system SHALL remove the staged temporary archive file and close any open archive read handle on success, on every validation failure, on request timeout, and on request disconnect or any unexpected error. The system SHALL abort in-progress extraction and any pending Core call when the client disconnects or the request times out.

The system SHALL NOT log archive contents, manifest contents, authentication tokens, cookies, or full request bodies.

#### Scenario: Temp file is removed after a successful import
- **WHEN** an archive import completes successfully
- **THEN** the staged temporary file is deleted and no archive read handle remains open

#### Scenario: Temp file is removed after a validation failure
- **WHEN** an archive import fails validation at any stage
- **THEN** the staged temporary file is deleted and no archive read handle remains open

#### Scenario: Client disconnect aborts the import
- **WHEN** the client disconnects while an archive import is being extracted or uploaded to Core
- **THEN** extraction and any pending Core call are aborted, and the staged temporary file is deleted

#### Scenario: Timeout aborts the import
- **WHEN** extraction or the Core call does not complete within the configured timeout
- **THEN** the request is aborted, the response reflects a service-unavailable condition, and the staged temporary file is deleted

### Requirement: `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` environment configuration

The system SHALL define `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` as a validated, optional environment variable in the Skills domain's environment configuration, with a documented default. The variable SHALL be distinct from the retired `SKILL_UPLOAD_MAX_BYTES` and from the existing decompressed-content limits (`SKILL_UPLOAD_MAX_FILES`, `SKILL_FILE_UPLOAD_MAX_BYTES`, `SKILL_UPLOAD_MAX_TOTAL_BYTES`). The variable and its default SHALL be documented in `apps/chat-api/README.md` and present in `apps/chat-api/.env.template`.

#### Scenario: Default applies when unset
- **WHEN** `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` is not set in the environment
- **THEN** the system uses its documented default compressed-ingress limit

#### Scenario: Configured value overrides the default
- **WHEN** `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` is set to a valid positive integer
- **THEN** the system enforces that value as the maximum accepted compressed archive size
