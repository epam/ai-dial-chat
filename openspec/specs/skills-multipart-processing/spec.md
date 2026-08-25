# skills-multipart-processing Specification

## Purpose
Specifies `SkillsPackageService`'s validation and outbound multipart construction for skill create/update requests: `filePaths`/`files` parity, path safety, file-count/size limits matching DIAL Core's own defaults, and building the one-part-per-file `FormData` DIAL Core's whole-skill write operation requires — with no ZIP ever constructed or forwarded.

## Requirements

### Requirement: `filePaths`/`files` parity validation
The BFF's package-processing component SHALL validate, before calling DIAL Core, that a create/update request's `filePaths` field is valid JSON containing an array of strings and that its length exactly matches the number of received `files` multipart parts, pairing each `filePaths[i]` with the `files` part received at the same position. A malformed `filePaths` value or a count mismatch SHALL be rejected with `400 Bad Request` without calling DIAL Core.

#### Scenario: Valid parity accepted
- **WHEN** `filePaths` is `["scripts/run.sh","assets/icon.png"]` and exactly two `files` parts are received
- **THEN** the component pairs `filePaths[0]` with the first received part and `filePaths[1]` with the second

#### Scenario: Malformed JSON rejected
- **WHEN** `filePaths` is not valid JSON, or does not parse to an array of strings
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Count mismatch rejected
- **WHEN** `filePaths` has a different length than the number of received `files` parts
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

### Requirement: Supporting-path safety and reservation rules
Each `filePaths` entry SHALL be validated against the same path-safety rules the skills domain already applies elsewhere (no absolute path, no Windows drive letter/backslash, no control characters, no empty/`.`/`..` segment, no `.dial-resource`/`.dial-folder` segment, no `files`/`v` first segment), SHALL be rejected if it equals `SKILL.md` (the manifest is supplied separately via `skillManifest`, never as a supporting file), and SHALL be rejected if it duplicates another entry in the same request.

#### Scenario: Path traversal rejected
- **WHEN** any `filePaths` entry contains a `..` segment or is an absolute path
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: SKILL.md as a supporting path rejected
- **WHEN** a `filePaths` entry is literally `SKILL.md`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Duplicate supporting path rejected
- **WHEN** two `filePaths` entries are identical
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Reserved marker or structural segment rejected
- **WHEN** a `filePaths` entry is named `.dial-resource`/`.dial-folder`, or has `files`/`v` as its first segment
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

### Requirement: File-count, per-file, and total-size limits enforced against real received bytes
The system SHALL reject a create/update request with `400 Bad Request` if the total file count (the manifest plus every supporting file) exceeds the configured file-count limit (default 100, matching DIAL Core's own `ComplexResourceService.Settings.maxFiles`), and with `413 Payload Too Large` if any single file's actual received byte length exceeds the configured per-file limit (default 1 MiB, matching Core's `maxFileSizeBytes`) or the sum of every file's actual received byte length exceeds the configured total limit (default 16 MiB, matching Core's `maxTotalBytes`). These checks SHALL run against the bytes actually received (post multipart-parsing), not any client-declared size.

#### Scenario: File count exceeds limit
- **WHEN** the manifest plus supporting files together exceed the configured file-count limit
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Per-file size exceeds limit
- **WHEN** any single received file's byte length exceeds the configured per-file limit
- **THEN** the system returns `413 Payload Too Large` and does not call DIAL Core

#### Scenario: Total size exceeds limit
- **WHEN** the sum of every received file's byte length exceeds the configured total limit
- **THEN** the system returns `413 Payload Too Large` and does not call DIAL Core

### Requirement: Outbound Core multipart construction — one part per file, no ZIP
The package-processing component SHALL build the outbound `FormData` sent to DIAL Core with one `file` part for the manifest (filename `SKILL.md`, content the received `skillManifest` text) plus one `file` part per validated supporting file (filename its exact `filePaths` entry, content its received bytes). It SHALL NOT construct, receive, or forward a ZIP archive anywhere in this path. No code in this component SHALL manually set a `Content-Type` header on the outbound request — the runtime `fetch` implementation generates the multipart boundary and header.

#### Scenario: One part per file, filenames are the relative paths
- **WHEN** a request has `skillManifest` and two supporting files at `scripts/run.sh` and `assets/icon.png`
- **THEN** the outbound `FormData` has three `file` parts, with filenames exactly `SKILL.md`, `scripts/run.sh`, and `assets/icon.png`

#### Scenario: No ZIP is ever constructed
- **WHEN** the outbound request built by this component is inspected
- **THEN** no part's content is a ZIP-formatted buffer — every part is either the raw manifest text or one supporting file's raw received bytes

#### Scenario: No manual Content-Type header
- **WHEN** the SDK call carrying this `FormData` is inspected
- **THEN** no code sets a `Content-Type` header on the request
