## ADDED Requirements

### Requirement: `/skill-editor` route in create mode
The system SHALL register `ROUTES.SkillEditor = '/skill-editor'` and a lazy-loaded `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` page, following the same `React.lazy` + `Suspense`/`RouteFallback` pattern used for `ROUTES.PromptEditor` in `apps/chat/src/app/app.tsx`. The route SHALL read an optional `returnUrl` query param; when absent or when it fails same-origin/local-path validation, the page SHALL default to `ROUTES.Catalog`.

#### Scenario: Navigating to the route renders the create form
- **WHEN** a user navigates to `/skill-editor?returnUrl=%2Fcatalog`
- **THEN** the page renders the Create-skill form with `SKILL.md` selected by default

#### Scenario: Unsafe returnUrl falls back to Catalog
- **WHEN** the `returnUrl` query param is an absolute external URL (e.g. `https://evil.example`)
- **THEN** the page treats it as invalid and falls back to `ROUTES.Catalog` for post-success/cancel navigation

### Requirement: Missing user bucket blocks upload with a recoverable error
The `SkillEditor` page SHALL read the current user's bucket via `useUser()`'s `user?.bucket`. When the bucket is `undefined` or an empty string (not yet resolved), the page SHALL render a recoverable error state explaining the bucket could not be resolved and SHALL NOT attempt to call `uploadSkill`.

#### Scenario: Bucket not yet resolved
- **WHEN** `useUser().user?.bucket` is `''` or `undefined` at the time a user clicks Create
- **THEN** the page shows a recoverable error state instead of calling `uploadSkill`, and no network request is made

#### Scenario: Bucket resolved, submit proceeds
- **WHEN** `useUser().user?.bucket` is a non-empty string
- **THEN** the page proceeds to build and upload the skill archive using that bucket

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

### Requirement: YAML frontmatter and ZIP archive construction
On submit, the `SkillEditor` page SHALL build `SKILL.md`'s content as YAML frontmatter (`name`, `description`, serialized via the installed `yaml` package's stringify function — no manual string interpolation of unescaped user content) followed by a blank line and the raw `instructions` text, then build a ZIP archive via `fflate` containing that `SKILL.md` at the archive root plus every supporting file/folder from the editor's in-memory state at their validated relative paths.

#### Scenario: Frontmatter is correctly escaped
- **WHEN** the Description field contains a colon, a newline, or a quote character
- **THEN** the generated frontmatter remains valid YAML that any standard YAML parser can parse back to the original string, because it was produced by the `yaml` library's stringify function rather than string concatenation

#### Scenario: Archive contains exactly the expected entries
- **WHEN** a skill has `SKILL.md` plus two supporting files at `agents/analyzer.md` and `assets/logo.png`
- **THEN** the built ZIP contains exactly three entries at those three paths, with `SKILL.md` at the archive root

#### Scenario: Archive construction failure is visible and announced
- **WHEN** ZIP construction throws (e.g. due to an internal serialization error)
- **THEN** the page shows a `role="alert"` error and does not attempt to call `uploadSkill`

### Requirement: Create-vs-replace preflight before upload
Before calling `uploadSkill`, the `SkillEditor` page SHALL call `listSkills({ bucket, path: <parent path> })` and check whether an item with the normalized name already exists at the target path. If one exists, the page SHALL show an inline conflict error and SHALL NOT call `uploadSkill`. If none exists, the page SHALL call `uploadSkill(bucket, path, file)` with no `ifMatch` (since a genuine create has no prior ETag). This is a best-effort, non-atomic check; the residual race is a documented, accepted limitation (see `design.md` D3).

#### Scenario: Preflight finds an existing skill
- **WHEN** `listSkills` returns an item at the normalized target path before upload
- **THEN** the page shows "A skill with this name already exists" and does not call `uploadSkill`

#### Scenario: Preflight is clear, upload proceeds
- **WHEN** `listSkills` returns no item at the normalized target path
- **THEN** the page calls `uploadSkill(bucket, path, file)` with the built ZIP and no `ifMatch`

### Requirement: HTTP error mapping for `uploadSkill`
The `SkillEditor` page SHALL interpret `uploadSkill` failures as follows and render a corresponding inline or notification error, keeping the form's field values intact for retry: `400` → invalid archive/path (inline, points at the offending field/path when derivable); `409` → naming conflict (same messaging as the preflight conflict, offering retry with a different name); `412` → precondition failed (not expected on create since no `ifMatch` is sent, but surfaced as a generic conflict if returned); `413` → archive too large (inline, suggests removing supporting files); `422` → too many files or archive validation failure (inline); `503` → service unavailable (notification, offers Retry which resubmits the same built archive without re-running ZIP construction).

#### Scenario: 413 response shows a size-specific message
- **WHEN** `uploadSkill` rejects with `413`
- **THEN** the page shows an inline message suggesting the archive is too large and to remove some supporting files, and does not clear the user's field values

#### Scenario: 503 response offers retry without rebuilding the archive
- **WHEN** `uploadSkill` rejects with `503`
- **THEN** the page shows a retry action that resubmits the exact same previously-built archive rather than reconstructing it from current form state

### Requirement: Submission state machine
The `SkillEditor` page SHALL track and expose to `SkillEditor` (the library component) an explicit state among `initial`, `dirty`, `submitting`, `success`, and `failure`. Cancel and Create SHALL be disabled only during `submitting`. Navigation to the resolved `returnUrl` SHALL occur only after `uploadSkill` resolves successfully (`success` state) or when the user explicitly cancels; a `failure` state SHALL NOT navigate away.

#### Scenario: Cancel navigates away immediately
- **WHEN** a user in the `dirty` state clicks Cancel
- **THEN** the page navigates to the resolved `returnUrl` without calling any API

#### Scenario: Failure does not navigate
- **WHEN** `uploadSkill` rejects
- **THEN** the page transitions to `failure`, remains on `/skill-editor`, and keeps all field values intact

#### Scenario: Success navigates once
- **WHEN** `uploadSkill` resolves successfully
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
