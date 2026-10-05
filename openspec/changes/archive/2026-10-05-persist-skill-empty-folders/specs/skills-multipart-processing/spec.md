## MODIFIED Requirements

### Requirement: Supporting-path safety and reservation rules
Each `filePaths` entry SHALL be validated against the same path-safety rules the skills domain already applies elsewhere: no absolute path, no Windows drive letter or backslash, no control characters, no empty/`.`/`..` segment, no `.dial-resource`/`.dial-folder` segment, and no `files`/`v` first segment. An entry SHALL be rejected if it equals `SKILL.md`, because the manifest is supplied separately via `skillManifest` and is never a supporting file. An entry SHALL be rejected if it duplicates another entry in the same request.

The folder-marker name `.dial_folder` (`MARKER_NAME` in `apps/chat-api/src/files/files.constants.ts`) SHALL be accepted only as the **final** segment of an entry whose received file part is exactly zero bytes, and only with at least one segment before it (a root-level `.dial_folder` is rejected). A `.dial_folder` segment in any other position, or a marker entry with a non-empty body, SHALL be rejected. Marker entries count toward the file-count limit like any other file.

This is a validation change to the existing `POST /api/v1/skills` (`createSkill`) and `PUT /api/v1/skills` (`updateSkill`) only. Request and response DTOs, operationIds and generated-client methods are unchanged, and `openapi.json` does not change.

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

#### Scenario: Zero-byte folder marker accepted
- **WHEN** `filePaths` is `["docs/.dial_folder"]` and its file part has 0 bytes
- **THEN** validation passes and the outbound Core multipart contains a `docs/.dial_folder` part

#### Scenario: Non-empty folder marker rejected
- **WHEN** `filePaths` is `["docs/.dial_folder"]` and its file part has 5 bytes
- **THEN** the system returns `400 Bad Request` with message `Invalid supporting file path: docs/.dial_folder` and does not call DIAL Core

#### Scenario: Misplaced folder marker rejected
- **WHEN** a `filePaths` entry is `.dial_folder` or `.dial_folder/a.md`
- **THEN** the system returns `400 Bad Request` and does not call DIAL Core
