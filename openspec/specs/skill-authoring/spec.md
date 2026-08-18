# skill-authoring Specification

## Purpose
Specifies `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`'s create-mode behavior: routing, bucket resolution, name normalization, client-side path safety, `SKILL.md` manifest construction, atomic create via the BFF's `createSkill`, its HTTP error mapping, required fields, submission state, responsive layout, and i18n coverage.

## Requirements

### Requirement: `/skill-editor` route in create mode
The system SHALL register `ROUTES.SkillEditor = '/skill-editor'` and a lazy-loaded `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` page, following the same `React.lazy` + `Suspense`/`RouteFallback` pattern used for `ROUTES.PromptEditor` in `apps/chat/src/app/app.tsx`. The route SHALL read an optional `returnUrl` query param; when absent or when it fails same-origin/local-path validation, the page SHALL default to `ROUTES.Catalog`.

#### Scenario: Navigating to the route renders the create form
- **WHEN** a user navigates to `/skill-editor?returnUrl=%2Fcatalog`
- **THEN** the page renders the Create-skill form with `SKILL.md` selected by default

#### Scenario: Unsafe returnUrl falls back to Catalog
- **WHEN** the `returnUrl` query param is an absolute external URL (e.g. `https://evil.example`)
- **THEN** the page treats it as invalid and falls back to `ROUTES.Catalog` for post-success/cancel navigation

### Requirement: Missing user bucket blocks upload with a recoverable error
The `SkillEditor` page SHALL read the current user's bucket via `useUser()`'s `user?.bucket`. When the bucket is `undefined` or an empty string (not yet resolved), the page SHALL render a recoverable error state explaining the bucket could not be resolved and SHALL NOT attempt to call `createSkill`.

#### Scenario: Bucket not yet resolved
- **WHEN** `useUser().user?.bucket` is `''` or `undefined` at the time a user clicks Create
- **THEN** the page shows a recoverable error state instead of calling `createSkill`, and no network request is made

#### Scenario: Bucket resolved, submit proceeds
- **WHEN** `useUser().user?.bucket` is a non-empty string
- **THEN** the page proceeds to build and submit the skill using that bucket

### Requirement: Deterministic name normalization
The `SkillEditor` page SHALL normalize the user-entered Name field on submit via a pure `normalizeSkillName` function: lowercase the input, replace whitespace and any character rejected by the client-side path-safety mirror with a hyphen, collapse consecutive hyphens, and trim leading/trailing hyphens. Normalization SHALL run before the client-side path-safety check and before constructing the upload path; it SHALL NOT be performed inside `libs/skill-editor`.

#### Scenario: Name with spaces and mixed case is normalized
- **WHEN** a user enters `"Good Morning Breakfast"` as the Name
- **THEN** the normalized name used for the upload path is `good-morning-breakfast`

#### Scenario: Name with repeated separators collapses
- **WHEN** a user enters `"weird -- name__here"`
- **THEN** the normalized name has no consecutive hyphens and no leading/trailing hyphen

### Requirement: Client-side path-safety mirror
The `SkillEditor` page SHALL implement a pure function mirroring `apps/chat-api/src/skills/utils/skill-path.util.ts`'s `isValidSkillRelativePath` (no absolute path, no Windows drive letters/backslashes, no control characters, no empty/`.`/`..` segment, no `.dial-resource`/`.dial-folder` segment, no `files`/`v` first segment) and SHALL apply it to the normalized skill name and to every supporting-file/folder path before allowing submission, surfacing violations as inline errors. This mirror SHALL be a client-side convenience for immediate feedback; the server remains authoritative and MAY still reject a request the client accepted.

#### Scenario: Reserved first segment rejected client-side
- **WHEN** a user adds a supporting file at path `files/notes.md`
- **THEN** the inline path error appears immediately, without waiting for a server round-trip

#### Scenario: Server rejection still surfaces correctly
- **WHEN** the client-side mirror passes a path that the server nonetheless rejects with `400`
- **THEN** the page surfaces the server's `400` response as a submit-time error (see the HTTP error mapping requirement) rather than silently succeeding

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

### Requirement: Submission state machine
The `SkillEditor` page SHALL track and expose to `SkillEditor` (the library component) an explicit state among `initial`, `dirty`, `submitting`, `success`, and `failure`. Cancel and Create SHALL be disabled only during `submitting`. Navigation to the resolved `returnUrl` SHALL occur only after `createSkill` resolves successfully (`success` state) or when the user explicitly cancels; a `failure` state SHALL NOT navigate away.

#### Scenario: Cancel navigates away immediately
- **WHEN** a user in the `dirty` state clicks Cancel
- **THEN** the page navigates to the resolved `returnUrl` without calling any API

#### Scenario: Failure does not navigate
- **WHEN** `createSkill` rejects
- **THEN** the page transitions to `failure`, remains on `/skill-editor`, and keeps all field values intact

#### Scenario: Success navigates once
- **WHEN** `createSkill` resolves successfully
- **THEN** the page transitions to `success`, shows a success notification, and navigates to the resolved `returnUrl` exactly once

### Requirement: Responsive layout — mobile inline accordion, desktop two-pane
At the `desktop` breakpoint, the page SHALL render the two-pane layout (Files sidebar + main form) with Cancel/Create in the page header. At the `mobile` breakpoint, the page SHALL render a single scrolling column where the Files pane starts collapsed as an "Editing file" summary row that expands in place to show the file tree, and Cancel/Create SHALL render in a `position: fixed` bottom action bar that remains reachable at any scroll position. Both breakpoints SHALL keep Back reachable in the page header.

#### Scenario: Desktop shows the two-pane layout
- **WHEN** the viewport is at the `desktop` breakpoint
- **THEN** the Files pane and the main SKILL.md form render side by side, with Cancel/Create in the header

#### Scenario: Mobile collapses the Files pane by default
- **WHEN** the viewport is at the `mobile` breakpoint and the page first renders
- **THEN** the "Editing file" summary shows collapsed, and Cancel/Create render in a fixed bottom bar

#### Scenario: Mobile Create remains reachable while scrolled
- **WHEN** a user on `mobile` scrolls to the bottom of the Instructions editor
- **THEN** the Create and Cancel actions remain visible in the fixed bottom bar without further scrolling

### Requirement: i18n coverage for all new user-visible strings
Every new user-visible string introduced by this change (page title, field labels, helper text, button labels, error messages, notifications, the Catalog "Skill" menu entry) SHALL be resolved through `useTranslation()` with keys following the `{domain}.{element}` convention (e.g. `skillEditor.title`, `skillEditor.nameCaption`, `catalog.create.skill`), added to `apps/chat/src/i18n/locales/en.json`. No new string SHALL be hardcoded in JSX.

#### Scenario: Every rendered string resolves through i18n
- **WHEN** `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` and its label-building code are searched for literal user-facing strings outside `t(...)` calls
- **THEN** none are found

### Requirement: Selecting a locally-uploaded supporting file in create mode opens its preview

In create mode, selecting a supporting-file node added via "Upload from device" SHALL open a preview of that file's in-memory bytes through the `skill-file-preview` capability, entirely from local browser state — no upload to the BFF occurs merely to preview a file. Selecting `SKILL.md` SHALL continue to show the create form exactly as today.

#### Scenario: Selecting a freshly uploaded file previews it without any network request
- **WHEN** a user uploads `agents/analyzer.md` from their device and then selects it in the tree
- **THEN** its content previews from the local `File` object with no request to `createSkill` or any other endpoint

#### Scenario: Preview does not interfere with the create submission flow
- **WHEN** a user previews a supporting file and then submits the create form
- **THEN** `createSkill` is called with the same `filePaths`/`files` it would have been called with had no preview ever been opened
