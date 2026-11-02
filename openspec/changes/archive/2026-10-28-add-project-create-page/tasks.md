**Slicing strategy: contract-first, then vertical.**

1. Slices 1–3 lock the BFF contract, the configuration and the generated client, because every UI slice depends on `ProjectsApi.createProject`, the `ProjectCreateErrorCode` enum and the client-config limits.
2. Slices 4–7 then build the UI.
3. Slice 8 adds the docs and the final verification.

Each slice ends green on its own. Run `npm run verify:changed` once at the end of each slice, not after each task.

## 1. BFF: shared name rule, manifest and limits configuration

- [x] 1.1 Create `apps/chat-api/src/common/validators/dial-entity-name.validator.ts` with:
  - `DIAL_ENTITY_NAME_FORBIDDEN_CHARS`, the `notAllowedSymbolsRegex` set moved out of `apps/chat-api/src/conversations/utils/conversation.utils.ts`;
  - `isValidDialEntityName(name)`, covering the deny set, `\p{Cc}`, `.`/`..`, Core's reserved `v`/`files`/`.dial-resource`/`.dial-folder`, no surrounding whitespace, and ≤255 UTF-8 bytes;
  - the `IsDialEntityName()` class-validator decorator.
  Make `conversation.utils.ts` import the regex instead of declaring it. Keep a single block comment explaining the shared origin.
  - Verification: `npm run test:file -- apps/chat-api/src/common/validators/dial-entity-name.validator.spec.ts` (new; accept/reject table including `../x`, `a/b`, `files`, NUL, U+202E, `Отчёт Q4 — 2026`, 255 vs 256 bytes) and `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-naming.spec.ts` (unchanged and still green).
- [x] 1.2 Create `apps/chat-api/src/projects/utils/project-manifest.util.ts` exporting `PROJECT_MANIFEST_FILE = 'PROJECT.md'`, `PROJECT_CONTEXT_FOLDER = 'context'` and `buildProjectManifest({ name, description, instructions })`. The frontmatter is built with `yaml` `stringify`, and the body follows verbatim.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-manifest.util.spec.ts` (new; round trip of `---`, `: `, `#`, newlines and quotes; empty description; instructions byte-for-byte).
- [x] 1.3 Add `PROJECT_CONTEXT_FILE_MAX_BYTES`, `PROJECT_CONTEXT_TOTAL_MAX_BYTES` and `PROJECT_CONTEXT_ALLOWED_EXTENSIONS` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`:
  - The extensions use a comma-list `@Transform` (trim, lower-case, strip a leading `.`, drop empties, and fall back to `['csv','pdf','xlsx']`) and `@Matches(/^[a-z0-9]{1,16}$/, { each: true })`.
  - Add the cross-field `TOTAL >= FILE` check to `validate` in `apps/chat-api/src/config/validation.ts`.
  - Document all three in `apps/chat-api/.env.template`.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts` (defaults, a custom list, `csv,../exe` failing boot, total < file failing boot).
- [x] 1.4 Add the `projects.contextFileMaxBytes`, `projects.contextTotalMaxBytes` and `projects.contextAllowedExtensions` entries to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`. Add their `CLIENT_CONFIG_MAPPINGS` rows in `apps/chat-api/src/app-config/client-config.mapper.ts`, and the `projectContextFileMaxBytes` / `projectContextTotalMaxBytes` / `projectContextAllowedExtensions` `@ApiPropertyOptional` fields on `ClientConfigDto`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`, `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` and `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`.

## 2. BFF: POST /api/v1/projects

- [x] 2.1 Add `apps/chat-api/src/projects/types/project-create-error-code.enum.ts` (`ProjectCreateErrorCode`, eight string members), `apps/chat-api/src/projects/dto/project-create-error.dto.ts` (`ProjectCreateErrorDto`), `apps/chat-api/src/projects/dto/create-project.dto.ts` and `apps/chat-api/src/projects/dto/create-project-response.dto.ts`:
  - `name` is `IsString` + `IsNotEmpty` + a 1024-character bound. The entity-name rule runs in `ProjectsCreateService` (task 2.3), so its failure carries `code: 'invalid-name'`, which a `ValidationPipe` error cannot.
  - `description` is optional and capped at 4000 code points, and `instructions` is optional and capped at 32000 code points. Both caps use a new `MaxCodePoints` decorator (`apps/chat-api/src/common/validators/max-code-points.validator.ts`).
  - `fileNames` is optional JSON text, defaulting to `'[]'`.
  - Every field has `@ApiProperty`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/create-project.dto.spec.ts` (new; it uses `plainToInstance` + `validate` and covers over-long fields counted in code points, a missing name, and the optional defaults) and `npm run test:file -- apps/chat-api/src/common/validators/max-code-points.validator.spec.ts` (new).
- [x] 2.2 Create `apps/chat-api/src/projects/project-context-upload.interceptor.ts`, modelled on `apps/chat-api/src/skills/import/skill-archive-upload.interceptor.ts`. It uses Multer memory storage, with `fileSize` set to `PROJECT_CONTEXT_FILE_MAX_BYTES` and `files` set to `PROJECT_CONTEXT_MAX_FILES = 100`. It maps `LIMIT_FILE_SIZE` to `413 file-too-large` and `LIMIT_FILE_COUNT` to `400 too-many-files`, both typed with `ProjectCreateErrorCode`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/project-context-upload.interceptor.spec.ts` (new).
- [x] 2.3 Create `apps/chat-api/src/projects/create/projects-create.service.ts` (`ProjectsCreateService`). It runs these checks, in this order, against the received parts, and then builds the outbound `FormData` (`PROJECT.md` plus `context/{name}` parts):
  1. `fileNames` parse and pairing;
  2. per-name `isValidDialEntityName`;
  3. duplicates;
  4. the extension allowlist from `ConfigService`;
  5. signatures for `pdf`/`xlsx`/`csv`;
  6. per-file size;
  7. total size;
  8. count.
  Use `Logger` and `ConfigService` per `apps/chat-api/AGENTS.md`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects-create.service.spec.ts` (new; every code, a renamed binary, `../PROJECT.md`, `sub/file.csv`, mismatched pairing, and exact-limit versus limit+1 boundaries).
- [x] 2.4 Add `createProject(bucket, input, files, accessToken, signal)` to `apps/chat-api/src/projects/projects.service.ts`. It delegates validation and `FormData` building to `ProjectsCreateService`, and calls `dialClient.client.uploadProjectFolder(bucket, encodeDialResourcePath(name), …)` once:
  - It sends `If-None-Match: '*'`, with the documented cast as in `createSkill`, and no `If-Match`.
  - Its signal is `AbortSignal.any([disconnect, AbortSignal.timeout(60_000)])`.
  - `412` becomes `ConflictException` with `name-taken`/`field: 'name'`. Any other status goes through `mapDialHttpStatus` / `handleDialSdkError`.
  - It logs the outcome, file count and total bytes only.
  Register `ProjectsCreateService` in `apps/chat-api/src/projects/projects.module.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.service.spec.ts` (extended; name-only sends one `PROJECT.md` part, a full create sends every part, the header assertion, 412→409, 500→502, a network error→503, a Cyrillic name encoded, and no name or content in the logs).
- [x] 2.5 Add the `@Post()` `createProject` handler to `apps/chat-api/src/projects/projects.controller.ts`, with:
  - `@HttpCode(201)`, `@Header('Cache-Control', 'no-store')`, `@UseInterceptors(ProjectContextUploadInterceptor)`, `@ApiConsumes('multipart/form-data')` and an `@ApiBody` multipart schema;
  - `@ApiOperation({ operationId: 'createProject' })` and `@ApiDialCoreErrors()`;
  - an `@ApiResponse` for 201/400/401/403/409/413/502/503 (`ProjectCreateErrorDto` where a body is returned).
  The handler reads `{ at, bucket }` from `SessionUser` and aborts on `req` `close`.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts` (extended; a supertest multipart create, the flag off → 403 with Core never called, unauthenticated → 401, unknown field → 400, oversized part → 413 `file-too-large`, and duplicate → 409 body shape).
- [x] 2.6 Slice check: `npm exec nx lint chat-api`, then `npm run verify:changed`.

## 3. Contract: refinement purposes, OpenAPI regeneration and the app API wrapper

- [x] 3.1 Add `ProjectDescription = 'project-description'` (4000) and `ProjectInstructions = 'project-instructions'` (32000) to `apps/chat-api/src/text-refinement/dto/refine-text.dto.ts`. Add the prompt files `apps/chat-api/src/text-refinement/prompts/project-description.prompt.ts` and `apps/chat-api/src/text-refinement/prompts/project-instructions.prompt.ts`, and the `TEXT_REFINEMENT_PROJECT_DESCRIPTION_PROMPT` / `TEXT_REFINEMENT_PROJECT_INSTRUCTIONS_PROMPT` env overrides (`environment.config.ts`, `.env.template`).
  - In `apps/chat-api/src/text-refinement/text-refinement.service.ts`, replace the scheduled-task `if` with a `PURPOSE_FEATURE` map that gates the scheduled-task purposes by `ScheduledTasksEnabled` and the project purposes by `ProjectsEnabled`.
  - Verification: `npm run test:file -- apps/chat-api/src/text-refinement/tests/text-refinement.service.spec.ts` (project purposes are 403 with the flag off, a 4001-character description is 400, the prompt override is used, and the existing scheduled-task gating is unchanged).
- [x] 3.2 Run `npm run openapi` and `npm run openapi:check`. Confirm that `libs/chat-api-client/openapi.json` has `createProject` with a strongly typed multipart body and responses, and that the generated `ProjectsApi.createProject`, `CreateProjectResponseDto`, `ProjectCreateErrorDto`, `ProjectCreateErrorCode`, the new `TextRefinementPurpose` members and the new `ClientConfigDto` fields exist. Do not hand-edit any generated file.
  - Verification: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`.
- [x] 3.3 Add `createProject({ name, description, instructions }, files: File[], signal?)` to `apps/chat/src/server-api/projects.api.ts`. It calls `projectsApi.createProject({ name, description, instructions, fileNames: JSON.stringify(files.map((f) => f.name)), files }, signal ? { signal } : undefined)` on the existing `ProjectsApi` singleton in `apps/chat/src/server-api/api-client.ts`. It is the normal method, not `Raw`, `fetch` or `base.ts`.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/projects.api.spec.ts` (extended).
- [x] 3.4 Slice check: `npm run verify:changed`.

## 4. Frontend config: project limits on AppConfig

- [x] 4.1 Add `projectContextFileMaxBytes`, `projectContextTotalMaxBytes` and `projectContextAllowedExtensions` to `AppConfigState.config` in `apps/chat/src/context/AppConfigContext.tsx`:
  - with the `DEFAULT_PROJECT_CONTEXT_*` module constants;
  - with validation (positive finite numbers, and an array of non-empty strings lower-cased on read);
  - keeping the last good value on a re-fetch failure.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx` (ready values, defaults while loading, on error and for an older BFF, `0` falling back, re-fetch failure keeping values).

## 5. Lib: ProjectCreateForm in libs/projects

- [x] 5.1 Add `@epam/ai-dial-attachment-input` (a sibling lib the host never names, so a `dependency` per `.claude/rules/libs.md`, at `"*"` like `conversation-input`) and the `@uiw/react-markdown-preview` / `@uiw/react-md-editor` packages that `LazyMarkdownEditor` needs (at the ranges `libs/scheduled-tasks` declares) to `dependencies` in `libs/projects/package.json`, and add the matching `external` and test-alias entries to `libs/projects/vite.config.mts`. Wire the tsconfig references or paths the Nx graph needs (use the `nx-workspace` skill if resolution fails). Run `npm run docs:install-matrix` and commit `docs/host-install-matrix.md`.
  - Verification: `npm run validate:docs`.
- [x] 5.2 Add the pure helpers and their types:
  - `libs/projects/src/types/project-name-error.ts` (the `ProjectNameError` enum);
  - `libs/projects/src/types/context-file-rejection.ts` (the `ContextFileRejection` enum);
  - `libs/projects/src/utils/project-name.ts` (`validateProjectName`, using `PROHIBITED_CONVERSATION_NAME_CHARS_RE` from `@epam/ai-dial-chat-shared`, plus control characters, bidi, reserved names and 255 bytes);
  - `libs/projects/src/utils/context-files.ts` (`checkContextFiles`, which returns `{ accepted: Attachment[]; rejected }` and builds each `Attachment` with `id`, `name`, `contentType`, `type`, `status` and `file`).
  - Verification: `npm run test:file -- libs/projects/src/utils/tests/project-name.spec.ts` (new; the same accept/reject table as task 1.1) and `npm run test:file -- libs/projects/src/utils/tests/context-files.spec.ts` (new; every rejection reason, the running total within one batch, and in-batch duplicates).
- [x] 5.3 Add `libs/projects/src/models/project-create-form-props.ts`, containing `ProjectCreateFormValues`, `ProjectCreateFormErrors`, `ProjectCreateFormLabels` (including `nameErrors: Record<ProjectNameError, string>`, `fileRejections: Record<ContextFileRejection, (name: string) => string>`, `capacityLabel(percent)`, `removeFileLabel(name)`, the status formatters and `refinement: TextRefinementLabels`), `ProjectCreateFormStyles` and `ProjectCreateFormProps`, with JSDoc on every member.
- [x] 5.4 Create `libs/projects/src/components/ProjectCapacityMeter/ProjectCapacityMeter.tsx`: `role="meter"`, with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`/`aria-valuetext`, the visible "N% of capacity used" text, and a token-colored bar. It is not rendered when `usedBytes === 0`.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectCapacityMeter/tests/ProjectCapacityMeter.spec.tsx` (new).
- [x] 5.5 Create `libs/projects/src/components/ProjectCreateForm/ProjectCreateForm.tsx` (and a `.module.scss` only if Tailwind cannot express a style):
  - **Header:** back (`IconArrowLeft` with `rtl:scale-x-[-1]`), the `<h1>`, Cancel, and Create, disabled per the spec.
  - **Name:** a kit `Input` with `aria-required`, `aria-invalid` and `aria-describedby`, and its error shown after blur or submit.
  - **Description:** a `Textarea` in `TextRefinementField`.
  - **Instructions:** `LazyMarkdownEditor()` loaded as in `libs/skill-editor/src/components/SkillEditor/SkillEditor.tsx`, in `TextRefinementField`.
  - **Refinement:** one pending at a time, via `useTextRefinement`.
  - **Context:** `FileDropzone` with `accept` built from `allowedExtensions`; a `ButtonDropdown` Add menu (device, and File manager only when `onPickFromFileManager` is supplied); `FileDndOverlay`; `AttachmentCard` items in a wrapping `<ul>`, each with a named remove button; the rejection list; and `ProjectCapacityMeter`.
  - **Status:** a hidden `role="status"` region, with `role="alert"` used for host errors.
  - Every Tabler icon gets `stroke={DIAL_KIT_ICON_STROKE}`.
  - Use `useMemo` for `usedBytes`/`percent`/`accept`.
  - Look up every kit component through the ui-kit MCP `getEntityDetails` before use.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx` (new; Create disabled until a valid name, the name error after blur, `errors.name` linked by `aria-describedby`, add from device through the drop-zone button, add from the file manager through the Add menu, a rejection listed and announced, remove updating the meter and hiding it at zero, `isSubmitting` blocking a second submit and announcing "Creating project…", and the back/Cancel callbacks).
  - The refinement cases (Refine Description and Instructions, one pending at a time disabling the other action and Create, and the actions hidden without callbacks) live in a `refinement` describe block of the same spec file, so the fixtures stay out of the lib build.
- [x] 5.6 Export `ProjectCreateForm`, its types and enums, `validateProjectName` and `checkContextFiles` from `libs/projects/src/index.ts`.
- [x] 5.7 Architecture guard: confirm that `libs/projects/src` contains:
  - no `/api` string;
  - no `@epam/ai-dial-chat-api-client`, `apps/chat` or `server-api` import;
  - no `react-i18next`, `react-router`, `useFeatureFlag` or app context;
  - no env, storage, analytics or DIAL file-manager import.
  The file-manager pick arrives only as `onPickFromFileManager`.
  - Verification: `npm exec nx lint projects`, and the existing "Lib has no host integration knowledge" test in `libs/projects/src/components/Projects/tests/Projects.spec.tsx`, extended to scan the new component folder.
- [x] 5.8 Slice check: `npm run verify:changed`.

## 6. Lib and app: New project buttons on the Projects page

- [x] 6.1 Add the optional `onCreateProject` prop and the optional `createProjectLabel` label to `libs/projects/src/models/projects-props.ts`. In `libs/projects/src/components/Projects/Projects.tsx`, render the header button (primary, `IconPlus` `aria-hidden` with the stroke token, at the inline end of the title row) and the `PanelEmptyState` `action` button only when the callback is supplied. Replace the "renders no New project action" test with tests for presence and absence.
  - Verification: `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx`.
- [x] 6.2 In `apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`, pass `onCreateProject={useCallback(() => navigate(ROUTES.ProjectCreate), [navigate])}`, and pass `createProjectLabel` from `ProjectsI18nKeys.PageNewProject`. This depends on tasks 7.1 and 7.2.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx` (both buttons navigate to `/projects/new`).

## 7. App: route, hooks, page and i18n

- [x] 7.1 Add the projects create keys from the `project-create-ui` spec, plus `projects.page.newProject`, to `apps/chat/src/i18n/locales/en.json` (with plural forms for `projects.create.status.added`). Add the matching members to `ProjectsI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx` (key resolution) and `npm run validate:specs`.
- [x] 7.2 Add `ProjectCreate = '/projects/new'` to `apps/chat/src/types/routes.ts`. Register the lazy `ProjectCreatePage` in `apps/chat/src/app/app.tsx` next to `ROUTES.Projects`, using the `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper and an async `React.lazy` loader.
  - Verification: `npm run test:file -- apps/chat/src/app/tests/app.spec.tsx` (`/projects/new` resolves to the create page) and `npm run test:file -- apps/chat/src/constants/tests/navigation.spec.ts` (Projects stays active on `/projects/new`).
- [x] 7.3 Create `apps/chat/src/hooks/projects/useCreateProject.ts`, with JSDoc on why it exists. It returns `{ create, isSubmitting }`, aborts on unmount, and normalises errors with `getApiErrorDetails` into `{ status, code }`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useCreateProject.spec.ts` (new; success, a 409 code, a 503, and an abort on unmount setting no state).
- [x] 7.4 Create `apps/chat/src/hooks/projects/useProjectFileManagerPicker.ts`, following `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts`. It has a promise-based `pickFromFileManager`, downloads each picked file with `downloadFile`, resolves `File[]`, and shows a `projects.create.toast.fileManagerError` toast that resolves `undefined` on failure. Also create `apps/chat/src/components/ProjectFileManagerModal/ProjectFileManagerModal.tsx`, which wraps `DialFileManagerModal` with `canAttachFolders={false}`, `allowedTypes` and `maxSelectableFileSize`.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjectFileManagerPicker.spec.ts` (new; attach resolves files, close resolves `undefined`, a download failure toasts, and unmount settles the pending pick).
- [x] 7.5 Create `apps/chat/src/pages/ProjectCreatePage/ProjectCreatePage.tsx`. It:
  - renders NotFound unless `useFeatureFlag('projectsEnabled')` is true;
  - owns `values`, `contextFiles` and `errors` in `useState`;
  - computes `isDirty` and passes it to `useBuilderLeaveGuard`;
  - reads the limits from `useAppConfig().config`;
  - gets the refinement callbacks from `useTextRefinementCallback(TextRefinementPurpose.ProjectDescription | ProjectInstructions)`, only when `aiTextRefinementAvailable` is true;
  - uses `formatFileSize` from `@epam/ai-dial-chat-shared`;
  - memoises `labels` with `useMemo` and its handlers with `useCallback`;
  - trims the name on submit;
  - maps errors per the spec: `name-taken`/`invalid-name` go inline with focus moved to Name, file codes go to `errors.context`, and anything else becomes a toast;
  - on success shows the toast, then calls `allowNextNavigation()`, then navigates to `ROUTES.Projects`.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectCreatePage/tests/ProjectCreatePage.spec.tsx` (new; flag off → NotFound with no request, a name-only create, a full create sending the files and `fileNames`, 409 inline with the draft kept, 413 `capacity-exceeded` → the context error, 503 toast, success toast and navigation without a prompt, Cancel while dirty opening the confirmation, a clean back with no prompt, and refinement wiring with the correct purposes).
- [x] 7.6 RTL and mobile pass on `ProjectCreateForm`, the `Projects` header button and `ProjectCreatePage`:
  - only logical classes (`ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`/`text-end`);
  - the back arrow mirrored, and the upload, plus and close icons not mirrored;
  - no `sm:`/`md:`/`lg:`/`xl:` prefixes;
  - on mobile, the header buttons kept visible while the title truncates, and the cards wrapping;
  - no horizontal scroll at 320 px with a 120-character name and file name.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx` (source scans: no physical direction classes, no `sm:`/`md:`/`lg:`/`xl:` prefixes, `rtl:scale-x-[-1]` on the back icon, and `flex-wrap` on the card list). A 320 px `scrollWidth` check is not run: jsdom computes no layout, so it would always pass. On mobile the header actions stay reachable through `BuilderFormContainer`'s sticky footer.
- [x] 7.7 Slice check: `npm run verify:changed`, then `npm run build:quiet`, because new lazy routes and new lib dependencies affect bundling.

## 8. Docs and final verification

- [x] 8.1 Update `libs/projects/README.md`:
  - **Peer Dependencies:** add `@epam/ai-dial-attachment-input`.
  - **Components:** add `ProjectCreateForm`, with a minimal example that passes every required prop. Add `onCreateProject`/`createProjectLabel` to the `Projects` section.
  - **Utilities:** add `validateProjectName` and `checkContextFiles`.
  - **Enums:** add `ProjectNameError` and `ContextFileRejection`.
  Every code fence must compile against the source.
- [x] 8.2 Update `apps/chat-api/README.md` with the `POST /api/v1/projects` endpoint, the `PROJECT.md` + `context/` layout as the chat's convention, and the three `PROJECT_CONTEXT_*` env vars and two `TEXT_REFINEMENT_PROJECT_*_PROMPT` env vars, with their Core ceilings.
- [x] 8.3 Update `docs/architecture.md`:
  - the `projects/` domain line becomes listing + creation;
  - the `/api/v1/projects` endpoint row gains `POST`;
  - `ProjectCreatePage` is added to the `pages/` list;
  - a one-line note records the `PROJECT.md` + `context/` convention.
- [x] 8.4 Run `npm run validate:docs` and `npm run validate:specs`, and fix any drift they report.
- [x] 8.5 Run `npm run verify:full` once, and record the result.

## 9. Projects list: card view per design

- [x] 9.1 Rebuild `libs/projects/src/components/ProjectCard/ProjectCard.tsx` on the kit `CardShell` (an `<article>` named by the project), with a one-line `Highlight` name and, under a divider, the kit `FolderPath` (`labels.folderPathLabel`; source label then `parentPath` folders). Drop the source badge and the date line, and the `formatUpdatedAt` prop with them. Replace the `cardBorder` / `badgeBackground` / `badgeText` / `metaText` colors with `cardDivider` / `pathText`, and the `badgeClassName` / `metaClassName` typography with `pathLabelClassName` / `pathLeafClassName`. Add `parentPath` to `ProjectItem`. The grid becomes one column, and three columns with a 20px gap at most 1116px wide from `desktop:`.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectCard/tests/ProjectCard.spec.tsx` and `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx`.
- [x] 9.2 In the app, copy `parentPath` in `apps/chat/src/utils/map-project-dto.ts`, drop `formatUpdatedAt` from `apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`, and replace the `projects.card.updatedAt` key with `projects.card.folderPath` in `en.json` and `ProjectsI18nKeys`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/map-project-dto.spec.ts` and `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx`.
- [x] 9.3 Update `libs/projects/README.md` (card, example, colors, typography, layout, `ProjectItem`), then run `npm run validate:docs` and `npm run verify:changed`.
