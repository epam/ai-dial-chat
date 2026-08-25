## MODIFIED Requirements

### Requirement: SKILL.md manifest construction; no ZIP archive
On submit, the `SkillEditor` page SHALL build `SKILL.md`'s content as YAML frontmatter followed by a blank line and the raw `instructions` text (see "Name, Description, and Instructions are all required" below). In create mode, the frontmatter SHALL be a freshly built object (`name`, `description`, serialized via the installed `yaml` package's stringify function — no manual string interpolation of unescaped user content) **unless a `SKILL.md` was imported via the upload dialog earlier in the same create session**, in which case the frontmatter SHALL be built by merging `name`/`description` into that imported frontmatter object (the same `buildSkillManifestFromFrontmatter` function edit mode already uses), so unknown fields the import carried (e.g. `version`) survive into the created skill. The page SHALL NOT build a ZIP archive for submission. It SHALL keep the manifest text and every supporting file's bytes in memory and submit them directly as `multipart/form-data`: `bucket`, `path`, `skillManifest` (the manifest text), `filePaths` (a JSON array of the supporting files' relative paths), and `files` (the supporting files' raw bytes, one part per entry, positionally paired with `filePaths`).

A folder node in the editor's file tree has no content of its own — DIAL Core stores files, not standalone directories, inside a skill. Only file-kind nodes SHALL be included in `filePaths`/`files`; folder nodes SHALL NOT produce any entry.

#### Scenario: Frontmatter is correctly escaped
- **WHEN** the Description field contains a colon, a newline, or a quote character
- **THEN** the generated frontmatter remains valid YAML that any standard YAML parser can parse back to the original string, because it was produced by the `yaml` library's stringify function rather than string concatenation

#### Scenario: Submission contains exactly the expected entries, no ZIP
- **WHEN** a skill has `SKILL.md` plus two supporting files at `agents/analyzer.md` and `assets/logo.png`
- **THEN** the submitted request's `filePaths` is `["agents/analyzer.md","assets/logo.png"]` with two matching `files` parts and no ZIP is constructed anywhere

#### Scenario: Manifest build failure is visible and announced
- **WHEN** manifest construction throws (e.g. due to an internal serialization error)
- **THEN** the page shows a `role="alert"` error and does not attempt to call `createSkill`

#### Scenario: An imported manifest's unknown fields survive into the created skill
- **WHEN** a user imports a `SKILL.md` containing a `version` field during a create session and then submits the form
- **THEN** the `skillManifest` sent to `createSkill` includes that `version` field, unchanged

## ADDED Requirements

### Requirement: Batch validation mirrors BFF package limits before commit

In create mode, the `SkillEditor` page's `fileActions.validateBatch` implementation SHALL, for every staged candidate, reject: a per-file size over `SKILL_FILE_UPLOAD_MAX_BYTES` (1 MiB); an invalid or unsafe path per the existing client-side `isValidSkillRelativePath` mirror; a path traversal attempt; a duplicate path within the staged batch itself; a duplicate path against a file already present in the editor's `files` state; and a reserved root path. At the batch level, it SHALL reject the whole batch if the projected total package size (sum of all already-present supporting-file bytes, all staged supporting-file bytes, and the UTF-8 byte size of the current or imported root `SKILL.md`) would exceed `SKILL_UPLOAD_MAX_TOTAL_BYTES` (16 MiB), or if the projected total file count (already-present supporting files, plus staged supporting files, plus exactly one for the root `SKILL.md`) would exceed `SKILL_UPLOAD_MAX_FILES` (100). These three limit constants SHALL be defined once and imported, not duplicated as inline magic numbers, and SHALL be documented as a client-side mirror of the BFF's authoritative `SkillsPackageService` limits — the BFF remains the final gate.

#### Scenario: Oversized file is rejected per-candidate
- **WHEN** a staged candidate's `File.size` exceeds `SKILL_FILE_UPLOAD_MAX_BYTES`
- **THEN** `validateBatch` marks that candidate invalid with a size-specific error, without reading its bytes

#### Scenario: Projected total size rejects the whole batch
- **WHEN** the sum of existing supporting-file bytes, staged supporting-file bytes, and the manifest's UTF-8 byte size exceeds `SKILL_UPLOAD_MAX_TOTAL_BYTES`
- **THEN** `validateBatch` returns a batch-level error and the batch cannot be committed until it is reduced

#### Scenario: Projected total file count rejects the whole batch
- **WHEN** existing files plus staged files plus the root manifest would exceed `SKILL_UPLOAD_MAX_FILES`
- **THEN** `validateBatch` returns a batch-level error naming the count limit

#### Scenario: Within-batch duplicate paths are both rejected
- **WHEN** two staged candidates resolve to the same path
- **THEN** both are marked invalid with a duplicate-path error, and neither can be committed without first removing one

#### Scenario: A staged path duplicating an existing file is rejected
- **WHEN** a staged candidate's path matches a path already present in the editor's `files` state
- **THEN** that candidate is marked invalid with a duplicate error; it is not silently treated as a replacement

### Requirement: Dropping a valid root SKILL.md populates the create form, with confirmation when dirty

When the staged batch contains exactly one candidate at the exact case-sensitive root path `SKILL.md` that decodes as valid UTF-8 and parses as YAML frontmatter with non-empty string `name` and `description`, `validateBatch` SHALL mark it with the manifest kind and a valid status (subject to the same 1 MiB size limit as any other candidate). On commit, if the create form's fields are currently dirty (per `onDirtyChange`'s most recently reported value), the page SHALL ask for explicit confirmation before overwriting Name, Description, and Instructions with the imported values; declining leaves the form and the rest of the staged batch's non-manifest candidates uncommitted as well, since the commit is atomic. On acceptance (or when the form was not dirty), the page SHALL populate Name/Description/Instructions from the imported manifest, store its frontmatter object (preserving any unknown properties such as `version`) as the frontmatter that subsequent create submissions serialize from, and commit the remaining staged supporting-file candidates in the same atomic update.

A staged batch containing more than one root-relative `SKILL.md` candidate SHALL fail batch validation with a single batch-level error; neither manifest candidate SHALL be committed. A root-level filename that differs from `SKILL.md` only by case (e.g. `skill.md`) SHALL be rejected as an ordinary invalid path naming the required exact casing, not treated as a second manifest candidate. A nested path such as `docs/SKILL.md` SHALL be validated as an ordinary supporting file, not as a manifest candidate.

#### Scenario: A valid SKILL.md import populates the form when the form is clean
- **WHEN** a user drops a valid `SKILL.md` while the create form has no unsaved edits, and confirms the batch
- **THEN** Name, Description, and Instructions populate from the imported manifest with no confirmation prompt

#### Scenario: A valid SKILL.md import asks for confirmation when the form is dirty
- **WHEN** a user has already edited the Name field and then drops a valid `SKILL.md`
- **THEN** committing the batch first asks for explicit confirmation before replacing the edited fields; declining leaves the form and the rest of the batch uncommitted

#### Scenario: Unknown frontmatter fields are preserved after import
- **WHEN** the imported `SKILL.md` has a `version: "1.0.0"` field the create form never renders
- **THEN** a subsequent create submission's serialized manifest still includes `version: "1.0.0"`

#### Scenario: A second root SKILL.md in the same batch fails validation
- **WHEN** a staged batch contains two candidates both resolving to the root path `SKILL.md`
- **THEN** `validateBatch` returns a batch-level error and neither is committed

#### Scenario: A case-variant root filename is rejected, not imported
- **WHEN** a staged candidate resolves to the root path `skill.md`
- **THEN** it is marked invalid with a message naming the required exact `SKILL.md` casing, and is not treated as a manifest candidate

#### Scenario: A nested SKILL.md is an ordinary supporting file
- **WHEN** a staged candidate resolves to `docs/SKILL.md`
- **THEN** it is validated and, if valid, committed as an ordinary supporting file, not as a manifest import

### Requirement: The generated root manifest is never uploaded as a supporting file

Whether typed manually or imported by dropping a `SKILL.md` file, the manifest sent to `createSkill` SHALL always be the page's own freshly generated `skillManifest` text (per the existing manifest-construction requirement); the raw bytes of an imported `SKILL.md` file SHALL never appear in `filePaths`/`files`, and the root `SKILL.md` path SHALL never be counted as a supporting file in the editor's `files` tree state.

#### Scenario: An imported SKILL.md is not present in the supporting-file tree
- **WHEN** a user imports a valid `SKILL.md` via the upload dialog
- **THEN** no `SKILL.md` node appears among the tree's supporting-file entries — the tree's existing single, protected `SKILL.md` node (from the `skill-editor-library` capability) is the only representation of it

#### Scenario: createSkill never receives the imported file's raw bytes as a supporting file
- **WHEN** a user imports `SKILL.md` and then submits the create form
- **THEN** the `filePaths` array sent to `createSkill` does not include `SKILL.md`, and `skillManifest` is the page's own generated text, not the imported file's untouched bytes
