## Context

#9596 added the read side of Projects:

- the `apps/chat-api/src/projects/` domain, whose `ProjectsService.listProjects` aggregates personal, organization and shared projects;
- the `@epam/ai-dial-projects` lib (`Projects`);
- the flag-gated `/projects` page.

Its listing derives `name` from the last path segment (`projects.mapper.ts`, `buildProject`), because Core metadata has no display name or description.

DIAL Core's side, verified in the local `ai-dial-core` checkout (commit `306bb2a0`, epam/ai-dial-core#2131):

- `ProjectHandler` "is an arbitrary file tree: no manifest or content validation is applied and the marker carries no type-specific metadata". The issue says explicitly that "no `PROJECT.md` descriptor or other manifest is required", while `ProjectHandlerTest` uses `PROJECT.md` as its example name.
- `ComplexResourceService.put` rejects a missing name, the reserved names (`v`, `.dial-resource`, `.dial-folder`, `files`), and an empty upload set (`At least one file is required`). It enforces per-type limits, with projects defaulting to 1,000 files, 64 MiB total and 5 MiB per file (`complexResource.types.projects`).
- `PUT /v2/projects/{bucket}/{path}` is the same create-or-update route as skills. Create-only is `If-None-Match: *` → `412` on collision. This was verified for skills against `EtagHeader` in `openspec/changes/archive/2026-08-13-fix-skill-editor-core-contract/design.md`. The SDK's "omit If-Match to create only" comment is wrong.

On the chat side, the closest models are:

- the create flow: `createSkill` (`apps/chat-api/src/skills/upload/skills-upload.service.ts`), with its multipart validation in `SkillsPackageService` and `fileNames`/`filePaths` pairing;
- the page split: `ScheduledTaskCreatePage` + `ScheduledTaskCreateForm`, controlled values, and `useBuilderLeaveGuard`;
- the copy-from-file-manager adapter: `useSkillFileSystemPicker`;
- the field wiring for Refine with AI and the markdown editor: `SkillEditor`.

The user decided four points while this change was being planned:

- `PROJECT.md` + `context/` layout;
- name = path;
- limits measured in bytes, configured through BFF env;
- an env-configurable extension list.

## Goals / Non-Goals

**Goals:**

- One atomic, create-only `POST /api/v1/projects` that stores the name, description, instructions and context files, with every limit enforced in the BFF and a typed error code per rejection.
- A host-agnostic `ProjectCreateForm` in `libs/projects`, and a thin app page that owns data, i18n, navigation and the file-manager bridge.
- Client-side checks that mirror the BFF rules exactly, through shared config values, so the UI rejects early and the BFF still rejects authoritatively.

**Non-Goals:** see the proposal. In short: no edit, rename or delete, no detail page, no folder or bucket choice, no file references, no token capacity, and no description on cards.

## Decisions

### D1. The chat owns the layout: `PROJECT.md` (frontmatter + body) and `context/`

`PROJECT.md` holds:

- the frontmatter fields `name` and `description`;
- the instructions, as the markdown body.

Context files go in `context/{fileName}`.

- **Why:** Core gives projects no metadata and requires at least one file, so a manifest file is unavoidable for a name-only project. Mirroring `SKILL.md` means:
  - a future editor can reuse the skill editor's frontmatter parsing (`skill-manifest-frontmatter.util.ts` uses `yaml`);
  - a ZIP download of a project is self-describing.
  A separate `context/` folder keeps user data from colliding with reserved metadata file names.
- **Alternatives:**
  - `project.json` + `INSTRUCTIONS.md`: two files to keep consistent, and a format unlike skills.
  - Context files at the root: a context file named `PROJECT.md` would have to be banned.
  The user chose the layout.
- **Format details:**
  - The frontmatter is produced with `yaml`'s `stringify`, never by string concatenation, so a description cannot inject keys or end the frontmatter early.
  - The body is the instructions verbatim.
  - No `version` key is added now. A reader treats a missing key as v1, so adding a version later stays backward-compatible.

### D2. The name is the resource path; one rule, two enforcement points

The name typed by the user becomes `projects/{bucket}/{name}` unchanged. The #9596 listing therefore shows it with no extra read, and Core detects duplicates atomically.

- **BFF:** `apps/chat-api/src/common/validators/dial-entity-name.validator.ts` becomes the single home of the DIAL entity-name deny set. The set moves out of `conversations/utils/conversation.utils.ts`, which re-imports it, and the existing conversation-naming tests keep pinning it. The validator also checks control characters, the reserved names, `.`/`..` and 255 UTF-8 bytes, and exposes an `IsDialEntityName` decorator.
- **Client:** `validateProjectName` in `libs/projects` uses `PROHIBITED_CONVERSATION_NAME_CHARS_RE` from `@epam/ai-dial-chat-shared`, and adds the control-character, bidi, reserved-name and byte-length checks. The client set is a subset, without NUL and bidi in the chat-shared regex, so the lib adds those explicitly. A lib unit test pins the lib rule against a fixture list shared in spirit with the BFF test (the same accept and reject table). A name the client accepts but the BFF rejects therefore fails a test, not a user.
- **No silent trim in the BFF:** the page trims before sending, and the BFF rejects surrounding whitespace. Two different trimmed names can therefore never map to the same path.
- **Alternative:** a slug path with the display name in `PROJECT.md`. Rejected in the proposal.

### D3. The BFF builds the manifest; the client sends fields plus `fileNames`

The client sends `name`, `description`, `instructions`, `fileNames` (JSON) and the `files` parts. The BFF builds `PROJECT.md`.

- **Why:** The BFF has to validate the name and description anyway. If it received a manifest, it would have to parse YAML and then check that the parsed name equals the path, which is more attack surface for no gain. It also keeps the file format out of the lib (library isolation) and out of the generated client contract.
- **`fileNames`:** for the reason `CreateSkillDto.filePaths` exists, browsers and busboy decode the multipart `filename` inconsistently for non-ASCII names, so the names travel as a JSON field.
- **Alternative:** a client-built manifest, as the skill editor does. Rejected, because the skill editor needs round-trip editing of arbitrary frontmatter, and this form does not.

### D4. One create-only Core call: `If-None-Match: *`, then `412` → `409 name-taken`

`ProjectsService.createProject` (delegating to a focused `ProjectsCreateService` for validation and `FormData` building, following `SkillsPackageService`) makes exactly one `uploadProjectFolder` call:

- It sends `If-None-Match: '*'`, with the same documented cast as `createSkill`.
- The signal combines the disconnect signal with a 60-second timeout. This is a domain constant, because 10 MiB uploads need more time than the 30-second listing deadline.
- `412` becomes `ConflictException` with `code: name-taken`. Every other status goes through `mapDialHttpStatus` / `handleDialSdkError`.
- **Why:** an atomic multi-file PUT means a failed create leaves nothing behind. A create-then-upload-files sequence (`uploadProjectFile` per file) would leave half-built projects on failure, and would need N+1 round trips.

### D5. Limits: env → `EnvironmentVariables` → config registry → `AppConfig`; three enforcement layers

| Layer | What it checks | Purpose |
| --- | --- | --- |
| `checkContextFiles` (lib, browser) | extension, per-file size, running total, duplicate name, name rule | instant feedback; nothing oversized is ever uploaded |
| `ProjectContextUploadInterceptor` (Multer, route-scoped) | per-file size, file count, aborted mid-stream | bounds memory before the service runs |
| `ProjectsCreateService` | pairing, names, extension + signature, per-file, total, count | the authoritative check, against the real received bytes |

- **Config path:** the values come from the env vars `PROJECT_CONTEXT_FILE_MAX_BYTES`, `PROJECT_CONTEXT_TOTAL_MAX_BYTES` and `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`. They are read once through `ConfigService` (the service) and through the registry keys `projects.*` (the client config). Both read the same `EnvironmentVariables` fields, so they cannot drift. The extension list reuses the trimmed comma-list `@Transform` pattern of `ENABLED_UI_FEATURES`, plus lower-casing and dot-stripping. Validation is `@Matches(/^[a-z0-9]{1,16}$/, { each: true })`, and a cross-field `TOTAL >= FILE` check runs in `validate` (`apps/chat-api/src/config/validation.ts`).
- **Count:** `PROJECT_CONTEXT_MAX_FILES = 100` is a BFF constant, not an env var. Assumption: with 1 MiB per file and 10 MiB in total, count is not a practical operator concern. If it becomes one, it can move to env later without a contract change.
- **Signature check:** it covers the three built-in types (`%PDF-`, `PK\x03\x04`, no NUL in a CSV prefix). It is not malware scanning. It only stops an arbitrary binary renamed to `.csv` from being stored as context. Any other operator-configured extension is checked by extension only, and the README states this.
- **Interceptor rather than module-wide `MulterModule`:** `SkillsModule` registers Multer module-wide and accepts Multer's generic 413. A route-scoped interceptor, the `SkillArchiveUploadInterceptor` precedent, can translate `LIMIT_FILE_SIZE`/`LIMIT_FILE_COUNT` into the typed codes. It also leaves the list endpoint untouched.
- **Memory:** the worst case is 10 MiB plus multipart overhead per in-flight request, held in memory. That is the same order as skills (16 MiB Core cap), and acceptable for a flag-gated feature.

### D6. File-manager context is copied by the app

`useProjectFileManagerPicker` (in the app) follows `useSkillFileSystemPicker`:

- It opens `DialFileManagerModal` with `canAttachFolders={false}`, `allowedTypes` mapped from the extensions, and `maxSelectableFileSize`.
- It downloads each picked file through the existing `downloadFile` wrapper.
- It resolves `File[]`, which the lib treats exactly like device files.

- **Why:** It reuses an adapter that already exists. Core has no API to copy a `files/` resource into a complex resource. A copy keeps the project self-contained: sharing or publishing a project does not depend on the source file's permissions.
- **Trade-off:** a picked file crosses the network twice (download, then upload). That is acceptable at 1 MiB per file.
- **Alternative:** sending the DIAL file URLs and having the BFF fetch them. Rejected for this iteration, because it is a new BFF fetch path with its own authorization questions (whose token reads the source file, and cross-bucket shares), for no user-visible gain at these sizes.

### D7. Component composition in `libs/projects`

`ProjectCreateForm` composes existing pieces rather than writing new ones:

- `BuilderFormContainer` from `@epam/ai-dial-builder-form` (a sibling `dependency`, as for `libs/scheduled-tasks`), for the back/title/Cancel/Create header and its mobile sticky footer;
- the kit `Input`, `Textarea`, `Label`, `ErrorText` and `ButtonDropdown`, and `FileDropzone`, which renders a label over a hidden file input, so it is keyboard-operable;
- `LazyMarkdownEditor` from `@epam/ai-dial-ui-kit/editors`, loaded lazily as in `SkillEditor`, so the editor bundle loads only with the page;
- `TextRefinementField` / `useTextRefinement` from `@epam/ai-dial-chat-shared`;
- `AttachmentCard` and `FileDndOverlay` from `@epam/ai-dial-attachment-input`, which already render a truncated name with a `title` tooltip, the type icon and the extension, and a named remove button;
- the context file model is `Attachment` from `@epam/ai-dial-chat-shared`, so cards need no adapter.

`@epam/ai-dial-attachment-input` becomes a `dependency` of `libs/projects`, not a peer: it is a sibling lib the host never names, exactly as it is for `conversation-input` (`.claude/rules/libs.md`). The `@uiw/react-markdown-preview` / `@uiw/react-md-editor` packages that `LazyMarkdownEditor` needs are added as dependencies at the ranges `libs/scheduled-tasks` declares. The install matrix is regenerated (`npm run docs:install-matrix`).

- **Rejected reuse:** `SkillFileDropOverlay` is not exported from `@epam/ai-dial-skill-editor`, and it hard-codes skill copy. `FileDndOverlay` is the exported, labels-driven equivalent.
- **Drag surface:** `useSkillFileDropZone` is not exported from `@epam/ai-dial-skill-editor`, so `libs/projects` carries a small `useFileDropSurface` hook with the same enter/leave counting. Moving one shared hook into `chat-shared` is a follow-up.
- **Name error wiring:** the kit `Input` sets no `aria-describedby` for its `error`, so the form renders its own `ErrorText` with an `id` and links it.
- **Capacity meter:** a small internal component, `ProjectCapacityMeter`, renders `role="meter"`. The kit has no meter, and a progressbar would announce an operation in progress rather than a level.

### D8. State ownership and flow

- **No new context.** `ProjectCreatePage` holds `values`, `contextFiles` and `errors` in `useState`.
- `useCreateProject` returns `{ create, isSubmitting }`, and aborts the request on unmount. Errors are normalised with `getApiErrorDetails` (`libs/chat-hooks/src/api-error/api-error.ts`) into `{ status, code }`, as `useScheduledTaskSubmit` does. That helper does not surface `field`. Extending it would change the `api-error-trace-correlation` contract, so server-side file rejections fall back to one generic message. The client pre-check already names each file, so this costs little. `ProjectCreateErrorDto.field` is still sent for API consumers and future use.
- The page turns codes into `errors.name` / `errors.context` or a toast, per the spec.
- `isDirty = values differ from '' || contextFiles.length > 0`. It feeds `useBuilderLeaveGuard`, which provides both the in-app confirmation and `beforeunload`.
- On success, the order is: toast, then `allowNextNavigation()`, then `navigate(ROUTES.Projects)`. This is the `ScheduledTaskCreatePage` order.
- The Projects list refetches on mount (the #9596 `useProjects`), so the new project appears without any cache invalidation.

### D9. Refinement purposes

`TextRefinementPurpose` gains `ProjectDescription = 'project-description'` (4,000) and `ProjectInstructions = 'project-instructions'` (32,000). Each has a built-in prompt file under `apps/chat-api/src/text-refinement/prompts/` and an optional `TEXT_REFINEMENT_PROJECT_*_PROMPT` override.

`TextRefinementService` gates both purposes behind `FeatureKey.ProjectsEnabled`, exactly like the scheduled-task purposes. The existing scheduled-task check is generalised into a small `PURPOSE_FEATURE` map (purpose → feature key and message), so a third gated domain does not add a third `if`. The frontend gets the purposes through the regenerated client.

## Authorization

- `POST /api/v1/projects`: an authenticated session, plus `projectsEnabled` for the caller (`FeatureGuard`, with roles from `PROJECTS_ENABLED_ROLES`). The target bucket is always the caller's own `SessionUser.bucket`. The request cannot name another bucket. Core enforces write permission with the caller's token.
- `POST /api/v1/text-refinement` with a project purpose: existing auth and CSRF, plus `projectsEnabled`.
- Client config keys: public limits, with no gating.

## UI states

- **Idle:** Create is disabled until the name is valid.
- **Name invalid:** an inline error after blur or a submit attempt.
- **Files rejected:** an inline list under the drop zone, also announced.
- **File-manager download failed:** a toast, and the pick resolves empty.
- **Refining:** the other Refine action and Create are disabled.
- **Submitting:** Create shows its loading state, and "Creating project…" is announced.
- **Error:**
  - `409` → inline on Name, with focus moved there;
  - file codes → inline under Context;
  - anything else → a toast.
  The draft is kept in every case.
- **Success:** a toast and navigation to the list.
- **Flag off:** NotFound.

There is no loading state for the page itself, because it fetches nothing on mount. The config values come from `AppConfigContext`, which has defaults while loading.

## Risks / Trade-offs

- **[Name = path makes rename a move later]** → Accepted with the user. The future edit change will use Core's move. The listing and sharing already key on the path.
- **[Unicode and punctuation names in Core URLs]** → `encodeDialResourcePath` already handles conversations and skills with non-ASCII names. BFF tests include a Cyrillic name and a name with spaces, `#` and `?` (allowed characters that need encoding).
- **[Client and BFF name rules drift]** → One BFF module, and a lib helper pinned by an accept/reject fixture table in both test suites. The BFF stays authoritative.
- **[Operator sets limits above Core's]** → Core returns `413`, which passes through as a typed Nest exception without our `code`, and the page shows the generic error toast. The README states the Core ceilings.
- **[YAML injection through the description]** → `yaml.stringify` handles serialization. A unit test feeds `---`, `: `, newlines and `#` and checks the round trip.
- **[A renamed binary gets past the extension check]** → The signature check covers the built-in types. Arbitrary configured types are documented as extension-only.
- **[Memory pressure from concurrent uploads]** → Bounded per request at 10 MiB by default, with Multer aborting mid-stream at the per-file cap. The route is flag-gated.
- **[`PROJECT.md` becomes a de-facto format other clients must follow]** → It is documented as the chat's convention in the `projects/` domain entry and the `/api/v1/projects` endpoint row of `docs/architecture.md`, and in `apps/chat-api/README.md`. It is not a Core rule. A client that ignores it still sees valid Core projects.

## Migration Plan

- Deploy is additive. The new env vars have defaults, and the feature ships behind `PROJECTS_ENABLED=false`.
- Order: the BFF (endpoint, config keys, refinement purposes), then `npm run openapi`, then the lib, then the app. All of it goes in one PR, so the generated client and its callers move together.
- **Rollback:** revert the PR. Projects already created stay valid Core resources and keep appearing in the #9596 listing. Their `PROJECT.md` is simply an ordinary file to any client that does not read it.

## Open Questions

None block implementation. Follow-ups for later changes:

- A project detail page as the post-create target. Navigation then switches from `ROUTES.Projects` to the new route.
- Whether cards should show the description, which needs a `PROJECT.md` read per card or a Core-side metadata extension.
- Whether `PROJECT_CONTEXT_MAX_FILES` needs to be an env var.
