## Why

The Projects page from #9596 only lists projects: it has no way to make one, and its **New project** button was deliberately left out (`openspec/changes/archive/2026-10-27-add-projects-page/proposal.md` Non-goals). Users need to create a project that bundles the instructions and reference data (tickets, survey results, knowledge-base exports) a conversation should use, so they stop re-attaching the same files and prompt every time. Issue #9605.

## Problem

- There is no write path for projects: neither `POST /api/v1/projects` in the BFF nor a page in the app.
- DIAL Core gives a project no fields to hold a description or instructions. `ProjectHandler` in `ai-dial-core` (commit `306bb2a0`, epam/ai-dial-core#2131) is "an arbitrary file tree: no manifest or content validation is applied and the marker carries no type-specific metadata". `ComplexResourceService.put` also rejects an empty file set (`400 At least one file is required`). The chat therefore has to define the on-disk layout itself, and a project created with only a name still has to contain a file.

## Solution

- **Storage layout, owned by the chat.** A project is `projects/{bucket}/{name}/` with:
  - `PROJECT.md` at the root: YAML frontmatter `name` and `description`, and the instructions as the markdown body. This mirrors `SKILL.md` and is the file name Core's own `ProjectHandlerTest` uses.
  - the context files under `context/`.
  A name-only project is a single `PROJECT.md`, which satisfies Core's non-empty rule.
- **Name is the path.** The project's resource name is the name the user typed, with no slug. This matches the listing from #9596, which takes `name` from the last path segment (`apps/chat-api/src/projects/projects.mapper.ts`, `buildProject`). It is validated on the client and in the BFF with the DIAL entity-name allowlist (`notAllowedSymbolsRegex` in `apps/chat-api/src/conversations/utils/conversation.utils.ts`, which also excludes `/`), plus Core's reserved names (`v`, `files`, `.dial-resource`, `.dial-folder`), and a 255-byte limit. A taken name is Core `412` → BFF `409` → an inline error on **Name**.
- **BFF `POST /api/v1/projects`** (`createProject`) in `apps/chat-api/src/projects/`, guarded by the existing `FeatureGuard` + `@RequireFeature(FeatureKey.ProjectsEnabled)`. It takes `multipart/form-data` (`name`, `description`, `instructions`, a JSON `fileNames` array paired with the repeated `files` parts, as `CreateSkillDto.filePaths` does), builds `PROJECT.md` on the server, enforces the type, per-file, total and file-count limits, and calls `uploadProjectFolder` once with `If-None-Match: '*'`. This follows `createSkill` in `apps/chat-api/src/skills/upload/skills-upload.service.ts:73`.
- **Limits are env-configured in the BFF** and published to the browser through the config registry (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`):
  - `PROJECT_CONTEXT_FILE_MAX_BYTES` (default 1 MiB);
  - `PROJECT_CONTEXT_TOTAL_MAX_BYTES` (default 10 MiB);
  - `PROJECT_CONTEXT_ALLOWED_EXTENSIONS` (default `csv,pdf,xlsx`).
  "Capacity" is measured in bytes: the sum of the context files' sizes divided by the total limit.
- **Context from the file manager is copied**, not referenced. The app downloads the picked DIAL file and stages it like a device upload, exactly as `useSkillFileSystemPicker` (`apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts`) does for skills.
- **Frontend:**
  - a new `ProjectCreateForm` in `libs/projects`, which is presentational and host-agnostic;
  - a flag-gated `ProjectCreatePage` at `/projects/new` in the app, which owns data, i18n, upload, refinement and navigation. It follows the `ScheduledTaskCreatePage` + `ScheduledTaskCreateForm` split.
  - **Both New project buttons** (the page header and the empty state) appear on the Projects page.
  - **Refine with AI** on Description and Instructions, through new `TextRefinementPurpose.ProjectDescription` / `ProjectInstructions` purposes gated by the projects flag.

## What Changes

- **BFF:**
  - `POST /api/v1/projects`, together with `CreateProjectDto`, `CreateProjectResponseDto` and a `ProjectsCreateService` (a `PROJECT.md` builder plus limit validation), with an `@ApiResponse` for 201/400/401/403/409/413/502/503;
  - three new env vars in `EnvironmentVariables`, `.env.template` and `apps/chat-api/README.md`, and three new client-visible config-registry keys under `projects.*`;
  - two new `TextRefinementPurpose` members with their own length limits and server-owned prompts. Their use requires the projects flag.
- **Generated client:** `npm run openapi` regenerates `libs/chat-api-client` with `ProjectsApi.createProject`.
- **`libs/projects`:**
  - `ProjectCreateForm` with its `ProjectCreateFormLabels` / `ProjectCreateFormProps` / `ProjectCreateFormStyles` / `ProjectCreateFormValues` / `ProjectCreateFormErrors` / `ProjectContextFile` types;
  - `Projects` gains an optional `onCreateProject` prop and a `createProjectLabel` label, which render the header and empty-state **New project** buttons;
  - the Projects card follows the design: the kit `CardShell` with the name and, under a divider, a `FolderPath` (source, then grouping folders). The source badge and the date line are removed, so the `formatUpdatedAt` prop and the `projects.card.updatedAt` key go too. The listing still has no description, so cards show none;
  - new dependencies `@epam/ai-dial-attachment-input` (for `AttachmentCard` / `FileDndOverlay`) and `@epam/ai-dial-builder-form` (for the `BuilderFormContainer` shell), plus a `@epam/ai-dial-ui-kit/editors` subpath use for `LazyMarkdownEditor` and its `@uiw/*` markdown dependencies.
- **App:**
  - the `ROUTES.ProjectCreate` route and the lazy `ProjectCreatePage`;
  - a `useCreateProject` hook and `createProject` in `apps/chat/src/server-api/projects.api.ts`;
  - a project file-manager picker, three new `AppConfig` fields, and new `projects.create.*` i18n keys.
- **Docs:** `docs/architecture.md`, `apps/chat-api/README.md`, `libs/projects/README.md`, and the regenerated `docs/host-install-matrix.md`.

## Capabilities

### New Capabilities

- `project-create-api`: `POST /api/v1/projects`, covering the multipart contract, the `PROJECT.md` + `context/` layout, name rules, limits, the create-only Core call and error mapping.
- `project-create-ui`: the `/projects/new` page and the `ProjectCreateForm` lib component, covering fields, Refine with AI, context files from both sources, the capacity meter, validation, submit/error/success, the leave guard, mobile, RTL and a11y.

### Modified Capabilities

- `projects-page-ui`: the **New project** buttons are added (header and empty state), so the "No New project button is rendered" clause is replaced.
- `navigation-routing`: adds the `ROUTES.ProjectCreate` (`/projects/new`) route.
- `ai-text-refinement`: adds the `project-description` / `project-instructions` purposes, gated by `projectsEnabled`.
- `config-registry-and-env-provider`: adds the three `projects.*` client config keys and their env vars.
- `app-config-context`: exposes the three project limits on the frontend `AppConfig`.

## Non-goals

- Editing, renaming, deleting or opening a project. There is no project detail page yet, so a successful create returns to `/projects`.
- Choosing a grouping folder or a target bucket. The project is always created at the root of the caller's own bucket.
- Keeping context files as live references to existing DIAL files. Picked files are copied.
- Token-based capacity, and any use of project content in chat requests.
- Showing `description` on Projects page cards. The listing metadata does not carry it, and reading `PROJECT.md` per card is a separate decision.

## Alternatives considered

- **Storage:** `project.json` + `INSTRUCTIONS.md` (two files to keep in sync, and unlike skills), or the context files at the root (then a context file named `PROJECT.md` would have to be banned, and the tree mixes metadata with data). `PROJECT.md` + `context/` was chosen with the user.
- **Name:** a slug path with the display name in `PROJECT.md`. Rejected: the #9596 listing would have to download a manifest per project, and Core could no longer detect duplicate names atomically.
- **Limits:** hard-coded constants (operators cannot tune them without a release) or token capacity (needs a tokenizer and a model choice). Rejected for bytes in env-config.
- **Building `PROJECT.md` in the browser** (as the skill editor does with `SKILL.md`). Rejected: the BFF would then have to parse YAML to validate the name and description anyway, and keeping the format on the server keeps it out of the lib.
- **Form location:** app-only. Rejected because the archived #9596 design put the Projects UI in `libs/projects` on purpose, expecting an editor to follow.

## Library isolation

`ProjectCreateForm` receives every string, the values and errors, `allowedExtensions`, `maxFileBytes` and `maxTotalBytes`, `onSubmit`, `onCancel`, `onPickFromFileManager` (resolving `File[]`) and the refinement callbacks through props. It imports no `@epam/ai-dial-chat-api-client`, REST path, feature flag, i18n, router or app context. The app edge owns all of these:

- the generated-client call (`apps/chat/src/server-api/projects.api.ts`);
- downloading the picked DIAL files (the project picker hook);
- navigation and toasts (`ProjectCreatePage`).

## Impact

- **i18n:** new keys under `projects.create.*` and `projects.page.newProject` in `en.json`, mirrored in `ProjectsI18nKeys`.
- **Scope creep:**
  - `libs/projects` gains dependencies (`@epam/ai-dial-attachment-input` and the `@uiw/*` markdown packages), so the install matrix is regenerated;
  - the BFF `TextRefinementPurpose` enum gains two members, which reach the app through the regenerated client (`apps/chat/src/hooks/useTextRefinementCallback.ts` imports it from `@epam/ai-dial-chat-api-client`);
  - no global provider or new context is added.
- **Rollback:** additive and behind `PROJECTS_ENABLED` (default `false`). Reverting the commit removes the endpoint, route and buttons. Projects that were already created stay valid Core resources, and the #9596 listing still lists them.

## Acceptance criteria

- With the flag off, `/projects/new` renders NotFound and `POST /api/v1/projects` returns `403` from `FeatureGuard`.
- Creating with only a name stores a single `PROJECT.md`. Creating with a description, instructions and files stores all of them, and the project then appears on `/projects`.
- A duplicate name gives `409`, shown inline on Name. An unsupported type, an oversized file and a total-capacity overflow are rejected on the client and by the BFF (`400` / `413` with a typed `code`).
- Cancel and back ask for confirmation while the form is dirty, and the unload guard is active while it is dirty.
- BFF and frontend tests cover the cases listed in #9605. `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.
- The layout is mobile-first with no horizontal scroll at 320 px. Only logical properties are used, the back arrow is mirrored in RTL, and the a11y items from #9605 hold (labels, `aria-required` / `aria-describedby`, a keyboard-operable drop zone, a `role="meter"` capacity meter, `aria-live` status, and named remove buttons).
