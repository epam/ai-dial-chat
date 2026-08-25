## ADDED Requirements

### Requirement: SKILL.md manifest construction; no ZIP archive
On submit, the `SkillEditor` page SHALL build `SKILL.md`'s content as YAML frontmatter followed by a blank line and the raw `instructions` text (see "Name, Description, and Instructions are all required" below). In create mode, the frontmatter SHALL be a freshly built object (`name`, `description`, serialized via the installed `yaml` package's stringify function — no manual string interpolation of unescaped user content). The page SHALL NOT build a ZIP archive for submission. It SHALL keep the manifest text and every supporting file's bytes in memory and submit them directly as `multipart/form-data`: `bucket`, `path`, `skillManifest` (the manifest text), `filePaths` (a JSON array of the supporting files' relative paths), and `files` (the supporting files' raw bytes, one part per entry, positionally paired with `filePaths`).

A folder node in the editor's file tree has no content of its own — DIAL Core stores files, not standalone directories, inside a skill. Only file-kind nodes SHALL be included in `filePaths`/`files`; folder nodes SHALL NOT produce any entry. The editor's file-add control offers only "Upload from device", so a folder node can only ever exist as one inferred from an uploaded file's own nested path or from a supporting file already present when a skill is loaded for editing; there is no way to create a folder node with nothing underneath it.

#### Scenario: Frontmatter is correctly escaped
- **WHEN** the Description field contains a colon, a newline, or a quote character
- **THEN** the generated frontmatter remains valid YAML that any standard YAML parser can parse back to the original string, because it was produced by the `yaml` library's stringify function rather than string concatenation

#### Scenario: Submission contains exactly the expected entries, no ZIP
- **WHEN** a skill has `SKILL.md` plus two supporting files at `agents/analyzer.md` and `assets/logo.png`
- **THEN** the submitted request's `filePaths` is `["agents/analyzer.md","assets/logo.png"]` with two matching `files` parts and no ZIP is constructed anywhere

#### Scenario: Manifest build failure is visible and announced
- **WHEN** manifest construction throws (e.g. due to an internal serialization error)
- **THEN** the page shows a `role="alert"` error and does not attempt to call `createSkill`

### Requirement: Create-time atomicity via createSkill; no preflight
Before calling `createSkill` in create mode, the `SkillEditor` page SHALL NOT perform a `listSkills` preflight check. It SHALL call `createSkill(bucket, path, skillManifest, filePaths, files)` directly. The BFF's `createSkill` sends `If-None-Match: '*'` to DIAL Core (its verified real create-only mechanism — read directly from DIAL Core's `EtagHeader` source, not inferred from an incomplete generated SDK type) and translates an upstream `412` collision to `409 Conflict`, which the page treats as the sole "a skill with this name already exists" case.

#### Scenario: Create proceeds directly to createSkill
- **WHEN** a user submits the create form
- **THEN** the page calls `createSkill(bucket, path, skillManifest, filePaths, files)` immediately, with no preceding `listSkills` call

#### Scenario: Create collision surfaces as a naming conflict
- **WHEN** `createSkill` rejects with `409 Conflict`
- **THEN** the page shows "A skill with this name already exists" as an inline Name-field error and does not clear other field values

#### Scenario: Successful create navigates on 201
- **WHEN** `createSkill` resolves successfully
- **THEN** the page treats the resulting `201 Created` response as success, shows a success notification, and navigates to the resolved `returnUrl`

### Requirement: HTTP error mapping for `createSkill`
The `SkillEditor` page SHALL interpret `createSkill` failures as follows and render a corresponding inline or notification error, keeping the form's field values intact for retry: `400` → the server's own validation message, shown verbatim when present; `409` → naming conflict (inline Name-field error, offering retry with a different name); `413` → a file or the total content is too large (inline, suggests removing/shrinking supporting files); `503` → service unavailable (notification, offers Retry which resubmits the same in-memory manifest/files without rebuilding anything).

#### Scenario: 400 shows the server's real message
- **WHEN** `createSkill` rejects with `400` and a message body (e.g. "Skill must contain a SKILL.md at its root")
- **THEN** the page shows that exact message rather than a generic, unrelated one

#### Scenario: 413 response shows a size-specific message
- **WHEN** `createSkill` rejects with `413`
- **THEN** the page shows an inline message suggesting a file or the total content is too large, and does not clear the user's field values

#### Scenario: 503 response offers retry without rebuilding anything
- **WHEN** `createSkill` rejects with `503`
- **THEN** the page shows a retry action that resubmits the exact same in-memory manifest/files rather than reconstructing them from current form state

### Requirement: Name, Description, and Instructions are all required
Although DIAL Core's own `SKILL.md` validation (`SkillHandler.validate`) only requires non-empty `name`/`description`, the product's own create/edit form SHALL additionally require a non-empty `instructions` value, matching the design's required-field marker on all three fields. The `SkillEditor` page SHALL require non-empty `name`, `description`, and `instructions` values before allowing submission in both create and edit mode.

#### Scenario: Empty Instructions blocks submission
- **WHEN** a user submits the form with a valid Name and Description but an empty Instructions field
- **THEN** the page shows a required-field error under Instructions and does not call `createSkill`/`updateSkill`

#### Scenario: Name and Description remain required
- **WHEN** a user submits the form with an empty Name or Description
- **THEN** the page shows the corresponding required-field error and does not call `createSkill`/`updateSkill`

## REMOVED Requirements

### Requirement: Create-vs-replace preflight before upload
**Reason**: Superseded by "Create-time atomicity via createSkill; no preflight" above — the BFF's `createSkill` now uses DIAL Core's verified real atomic-create mechanism (`If-None-Match: '*'`), removing the need for (and the residual race inherent to) a `listSkills`-then-upload preflight.
**Migration**: `SkillEditor.tsx`'s `handleSubmit` calls `createSkill` directly; `listSkills` is unchanged and still used elsewhere.

### Requirement: YAML frontmatter and ZIP archive construction
**Reason**: Superseded by "SKILL.md manifest construction; no ZIP archive" above — DIAL Core's real whole-skill write contract (verified in `ComplexResourceController`/`EtagHeader` source) never accepts a ZIP; the page now submits the manifest text and supporting-file bytes directly as multipart fields instead of building an archive.
**Migration**: `apps/chat/src/utils/skill.ts`'s `buildSkillArchive` (ZIP construction) is removed from the create-submit path; `buildSkillManifest` (YAML frontmatter text) is retained and reused for the new multipart `skillManifest` field.

### Requirement: HTTP error mapping for `uploadSkill`
**Reason**: Superseded by "HTTP error mapping for `createSkill`" above — the create wrapper is renamed `createSkill` per the BFF's split `POST`/`PUT` contract (`skills-bff-api`), and `412` is no longer a status create-mode's error mapping needs to handle (create never sends `If-Match`, so a create attempt cannot receive Core's `412` — only `409`, already covered by "Create collision surfaces as a naming conflict").
**Migration**: Replace any `uploadSkill`-error-mapping call site with `createSkill`'s; drop the `412`-in-create-mode defensive branch, since it is now provably unreachable rather than merely believed unlikely.
