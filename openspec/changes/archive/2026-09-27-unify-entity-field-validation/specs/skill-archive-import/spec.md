## MODIFIED Requirements

### Requirement: Manifest content validation

The system SHALL decode the archive's `SKILL.md` entry as strict UTF-8, rejecting (`400`) any byte sequence that is not valid UTF-8. The system SHALL parse the manifest's YAML frontmatter and require non-empty string `name` and `description` fields, rejecting (`400`) a manifest with missing frontmatter, malformed YAML, an empty or non-string `name` or `description`, a trimmed `name` longer than 256 characters, or a trimmed `description` longer than 2000 characters (bounds from `apps/chat-api/src/common/validators/entity-field-limits.ts`, see `entity-field-limits`).

The system SHALL derive the destination Skill path from the manifest's `name` field using the same path-safety contract the manual Skill-creation flow already applies to a Skill's destination path. The system SHALL NOT rewrite or otherwise modify the uploaded `SKILL.md` content; only the destination path is computed from `name`.

#### Scenario: Invalid UTF-8 manifest is rejected
- **WHEN** the archive's `SKILL.md` entry contains a byte sequence that is not valid UTF-8
- **THEN** the response is `400 Bad Request`

#### Scenario: Missing or invalid frontmatter is rejected
- **WHEN** `SKILL.md`'s YAML frontmatter is missing, malformed, or has an empty or non-string `name` or `description`
- **THEN** the response is `400 Bad Request`

#### Scenario: Over-long name or description is rejected
- **WHEN** `SKILL.md`'s frontmatter `name` is longer than 256 characters or its `description` is longer than 2000 characters
- **THEN** the response is `400 Bad Request` and no Skill is created

#### Scenario: Manifest content is stored unmodified
- **WHEN** a valid archive is imported
- **THEN** the created Skill's `SKILL.md` content is byte-for-byte identical to the archive's `SKILL.md` entry

### Requirement: Standalone SKILL.md content validation

The system SHALL decode a standalone `SKILL.md` upload as strict UTF-8, rejecting (`400`) any byte sequence that is not valid UTF-8. The system SHALL parse the manifest's YAML frontmatter and require non-empty string `name` and `description` fields, rejecting (`400`) a manifest with missing frontmatter, malformed YAML, an empty or non-string `name` or `description`, or a `name`/`description` over its 256/2000-character limit — using the exact same parsing and validation rules already applied to a `SKILL.md` entry inside an archive.

The system SHALL derive the destination Skill path from the manifest's `name` field using the same path-safety contract the archive-import and manual Skill-creation flows already apply to a Skill's destination path. The system SHALL NOT rewrite or otherwise modify the uploaded `SKILL.md` content; only the destination path is computed from `name`.

The created Skill SHALL contain exactly one file, `SKILL.md`, with content byte-for-byte identical to the uploaded file.

#### Scenario: Invalid UTF-8 standalone manifest is rejected
- **WHEN** a standalone `SKILL.md` upload contains a byte sequence that is not valid UTF-8
- **THEN** the response is `400 Bad Request`

#### Scenario: Missing or invalid frontmatter is rejected
- **WHEN** a standalone `SKILL.md` upload's YAML frontmatter is missing, malformed, or has an empty or non-string `name` or `description`
- **THEN** the response is `400 Bad Request`

#### Scenario: Blank-but-present name or description is rejected
- **WHEN** a standalone `SKILL.md` upload's frontmatter has `name` or `description` present as a string containing only whitespace
- **THEN** the response is `400 Bad Request`

#### Scenario: Valid standalone manifest content is stored unmodified
- **WHEN** a valid standalone `SKILL.md` is imported
- **THEN** the created Skill's `SKILL.md` content is byte-for-byte identical to the uploaded file, and the Skill contains no other files

#### Scenario: Empty file is rejected
- **WHEN** a standalone `SKILL.md` upload has zero bytes
- **THEN** the response is `400 Bad Request` (empty content has no YAML frontmatter)
