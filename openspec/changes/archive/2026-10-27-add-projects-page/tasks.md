Slicing strategy: **risk-first, then vertical**.

- Slice 1 checks the DIAL Core assumptions (design D3/D4) and lands the flag.
- Slice 2 ships the BFF endpoint and its OpenAPI contract end to end.
- Slices 3 and 4 build the lib and the page on that contract.
- Slice 5 adds navigation, then docs, then a single full verification.

Each slice depends on the previous one.

## 1. Feature flag and Core-shape check (risk-first)

- [x] 1.1 Check the two Core assumptions against a dev DIAL Core with an SDK call, or against the SDK/Core OpenAPI if no environment is reachable:
  - D3: `listProjectMetadata(<own bucket>, '')` for a user with no projects answers 404, not 200 with empty `items`;
  - D4: `getSharedResources({ resourceTypes: ['PROJECT'], with: 'me' })` item URLs have the shape `projects/{bucket}/{path}`.

  Record the observed shapes in `design.md` (D3/D4 "Assumption to verify" lines) before writing the mapper fixtures.
  - Verification: `design.md` D3/D4 state the observed behaviour.
- [x] 1.2 Add `ProjectsEnabled = 'features.projectsEnabled'` to `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`, directly after `ScheduledTasksEnabled`.
- [x] 1.3 Add the `features.projectsEnabled` entry to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`. Fields: `type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`, `critical: false`, `owner: 'chat-team'`, `envVar: 'PROJECTS_ENABLED'`, `allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES'`, and a description that names the endpoint, the page and the nav entry.
- [x] 1.4 Add `PROJECTS_ENABLED?: boolean = false` and `PROJECTS_ENABLED_ROLES?: string[] = []` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, copying the `SCHEDULED_TASKS_ENABLED*` decorators.
- [x] 1.5 Extend the existing registry, env-config and client-config tests:
  - the new key resolves `false` by default;
  - it resolves `true` with `PROJECTS_ENABLED=true`;
  - it is restricted by `PROJECTS_ENABLED_ROLES`;
  - it appears in the client config.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`, plus the config-registry spec under `apps/chat-api/src/app-config/tests/config-registry/` that asserts `FeatureKey` ↔ registry parity.

## 2. BFF `GET /api/v1/projects` (vertical slice, backend + contract)

- [x] 2.1 Create the DTOs in `apps/chat-api/src/projects/dto/`:
  - `project-source.enum.ts`: the `ProjectSource` string enum;
  - `project.dto.ts`: the `ProjectDto` class, with `@ApiProperty`/`@ApiPropertyOptional` on every field and `enumName: 'ProjectSource'`;
  - `list-projects-response.dto.ts`: `ListProjectsResponseDto` with `items: ProjectDto[]`.
- [x] 2.2 Implement `apps/chat-api/src/projects/projects.mapper.ts`:
  - `mapProjectMetadata(item, source)`: ITEM only; requires `bucket` and `name`; `path` = `parentPath/name`; `id` = `projects/{bucket}/{path}`;
  - `mapSharedProject(resource)`: `safeDecodeURIComponent` the URL, strip trailing slashes, require the `projects/{bucket}/{path…}` prefix, derive the fields.

  Reuse `StringUtils.stripTrailingSlashes` and `safeDecodeURIComponent`, and do not import skill utilities.
- [x] 2.3 Unit-test the mapper in `apps/chat-api/src/projects/tests/projects.mapper.spec.ts`. Cover:
  - folders are dropped;
  - malformed items are skipped;
  - nested `parentPath`;
  - a trailing slash in Core's `url` does not leak into `id`;
  - shared URLs with a foreign prefix, a missing bucket or an empty path are dropped;
  - percent-encoded shared URLs are decoded.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.mapper.spec.ts`
- [x] 2.4 Implement `apps/chat-api/src/projects/projects.service.ts` (`ProjectsService`, with `Logger` and `DialClientService`), following `listCatalogSkills` / `listAllSkillItems` / `listSharedSkills` in `apps/chat-api/src/skills/listing/skills-listing.service.ts`. It needs:
  - a bucket walker using `listProjectMetadata(bucket, encodeDialResourcePath(''), …)` with `recursive: true` and `limit: 1000`;
  - the `MAX_UPSTREAM_PAGES_PER_SOURCE = 20` cap, which logs a warning naming the source kind;
  - repeated cursor → `BadGatewayException('DIAL Core returned an invalid project listing page')`;
  - root-page 404 → `[]`;
  - `PROJECTS_LISTING_TIMEOUT_MS = 30_000` via `AbortSignal.timeout`;
  - `getBearerAuthHeaders(at)` on every call;
  - `handleDialSdkError(…, 'projects.listProjects', …)`.
  - `listProjects(bucket, at)`:
    - settles personal and `PUBLIC_BUCKET` with `allSettled`;
    - lists the shared projects, where an error is logged and yields `[]`;
    - rethrows the personal error only when both bucket listings rejected;
    - de-duplicates with personal > organization > shared precedence.

  Logs never include tokens, cursors or bucket ids.
- [x] 2.5 Unit-test the service in `apps/chat-api/src/projects/tests/projects.service.spec.ts`, mocking `DialClientService.client`. Cover:
  - the happy-path merge with source tags;
  - a three-page walk forwarding `nextToken`;
  - the page cap returning the collected items with one warning;
  - a repeated cursor failing only that source;
  - dedup precedence;
  - a root 404 counting as an empty source;
  - organization-only failure → personal + shared;
  - both failing → personal error mapped (timeout → `ServiceUnavailableException`, 500 → `BadGatewayException`, 403 → `ForbiddenException`, 429 → 429);
  - a shared error → no shared items;
  - the bearer header and `recursive: true` being sent.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.service.spec.ts`
- [x] 2.6 Implement `apps/chat-api/src/projects/projects.controller.ts`:
  - `@ApiTags('projects')` and `@Controller({ path: 'projects', version: '1' })`;
  - `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.ProjectsEnabled)`;
  - `@Get()` `listProjects(@Req() req)` reading `bucket`/`at` from `SessionUser`;
  - `@Header('Cache-Control', 'private, no-store')`;
  - `@ApiOperation({ operationId: 'listProjects', … })`;
  - `@ApiResponse` for 200 (`type: ListProjectsResponseDto`), 401 and 403, plus `@ApiDialCoreErrors()`.

  Add `apps/chat-api/src/projects/projects.module.ts` (imports `AppConfigModule`, and whatever provides `DialClientService`, matching the skills module), and register `ProjectsModule` in `apps/chat-api/src/app/app.module.ts`.
- [x] 2.7 Write the controller integration test (supertest) in `apps/chat-api/src/projects/tests/projects.controller.spec.ts`. Cover:
  - 200 with the service result and `Cache-Control: private, no-store`;
  - 403 when `FeatureGuard` denies, with the service not called;
  - query-string `bucket`/`path` values (including `../`) are ignored and the service receives the session bucket;
  - service exceptions surface as their HTTP status.
  - Verification: `npm run test:file -- apps/chat-api/src/projects/tests/projects.controller.spec.ts`
- [x] 2.8 Regenerate the contract: run `npm run openapi` and `npm run openapi:check`, then `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Confirm that `libs/chat-api-client/openapi.json` contains `listProjects`, `ListProjectsResponseDto`, `ProjectDto` and the `ProjectSource` enum. Do not hand-edit generated files.
- [x] 2.9 Add `export const projectsApi = new ProjectsApi(config);` to `apps/chat/src/server-api/api-client.ts`. Create `apps/chat/src/server-api/projects.api.ts` exporting `listProjects({ signal }: { signal?: AbortSignal } = {}): Promise<ListProjectsResponseDto>`, which delegates to `projectsApi.listProjects(...)` with the signal passed as the init override. Add the wrapper test in `apps/chat/src/server-api/tests/projects.api.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/projects.api.spec.ts`
- [x] 2.10 Slice check: `npm run verify:changed`.

## 3. Presentational lib `@epam/ai-dial-projects`

- [x] 3.1 Scaffold `libs/projects` with the `nx-generate` skill, mirroring `libs/scheduled-tasks`: Vite lib build, Vitest, ESLint, `tsconfig.lib.json`/`tsconfig.spec.json`.
  - `package.json` follows `.claude/rules/libs.md`:
    - `name: "@epam/ai-dial-projects"`, then `description` and `license: "Apache-2.0"` after `version`;
    - `private: true` and the `publishable` tag with the same `publish` target;
    - `exports` with `@epam/source`;
    - `react` and `@epam/ai-dial-ui-kit` peers at the scheduled-tasks ranges, and `@epam/ai-dial-chat-shared` as a `*` peer;
    - `@tabler/icons-react` as a dependency at the scheduled-tasks range.
  - Add the `tsconfig.base.json` path, the root `tsconfig.json` and `apps/chat/tsconfig.app.json` references, and the `@epam/ai-dial-projects` alias in `apps/chat/vite.config.mts`, then run `npm install` to link the workspace package. `apps/chat/package.json` lists no workspace libs, so it is not changed.
  - Remove all Nx scaffold text.
- [x] 3.2 Add the types under `libs/projects/src/`:
  - `types/project-source.ts` (`ProjectSource` string enum);
  - `types/projects-sort-key.ts` (`ProjectsSortKey`: `Newest = 'newest'`, `Oldest = 'oldest'`, `NameAsc = 'name-asc'`);
  - `models/project-item.ts`;
  - `models/projects-props.ts` (`ProjectsLabels`, including `sourceLabels: Record<ProjectSource, string>` and `resultCountLabel: (count: number) => string`; `ProjectsColors`/`ProjectsTypography`/`ProjectsStyles`; `ProjectsProps`).

  Every exported symbol gets brief JSDoc per `.claude/rules/libs.md`.
- [x] 3.3 Implement `filterProjects` (trimmed, case-insensitive substring match on `name`) and `sortProjects` in one domain utils file, `libs/projects/src/utils/projects.ts` (per `.claude/rules/all-ts.md` file naming):
  - Newest/Oldest by `updatedAt`, with undated items last in both orders;
  - ties broken by name;
  - Name A–Z via `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.

  Unit-test both in `libs/projects/src/utils/tests/`.
  - Verification: `npm run test:file -- libs/projects/src/utils/tests/projects.spec.ts`
- [x] 3.4 Implement `libs/projects/src/components/ProjectCard/ProjectCard.tsx`:
  - an `<li>` holding the name via kit `Highlight` (`query`, `maxLines={2}`);
  - a source badge;
  - `<time dateTime={new Date(updatedAt).toISOString()}>{formatUpdatedAt(updatedAt)}</time>` only when `updatedAt` is set.

  The card is not interactive.
- [x] 3.5 Implement `libs/projects/src/components/Projects/Projects.tsx`, modeled on `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`:
  - an `<h1>` title and a subtitle;
  - a toolbar with kit `Search` inside `<div role="search">` and a `ButtonDropdown` sort (`IconArrowsSort`, the applied option marked with `MenuItemMark`, accessible name = sort label + applied option);
  - exactly one content state: `Spinner`, error + retry `GhostButton`, `PanelEmptyState` empty, `PanelEmptyState` no-results, or the `<ul>` grid of `ProjectCard`;
  - a visually hidden `role="status" aria-live="polite"` region;
  - a filtered/sorted list in `useMemo` keyed on `projects`/`searchQuery`/`sortKey`/`locale`;
  - colors via `buildCssVars`, with theme-token fallbacks of at least 7:1 contrast for text.

  No **New project** button. Every declared prop is read.
- [x] 3.6 Responsive and RTL pass on `libs/projects/src/components/**`. Use the `responsive-design` skill.
  - Mobile-first: a one-column `<ul>` by default and a `desktop:` auto-fill grid; the toolbar stacks on mobile.
  - No `sm:`/`md:`/`lg:`/`xl:`/`small_tablet:` prefixes.
  - Long names clamp or wrap with no horizontal overflow at 320 px.
  - Only logical classes (`ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`, `border-s`/`border-e`). There is no directional icon, so nothing is mirrored.
  - Run `grep -nE '\b(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-' libs/projects/src` and expect no matches.
- [x] 3.7 Accessibility pass:
  - every Tabler icon has `stroke={DIAL_KIT_ICON_STROKE}`;
  - decorative icons have `aria-hidden`;
  - the status region announces the result count, no-results, empty and error states, and nothing while loading;
  - the sort and retry controls are keyboard-operable.
- [x] 3.8 Write the component tests in `libs/projects/src/components/Projects/tests/Projects.spec.tsx` and `libs/projects/src/components/ProjectCard/tests/ProjectCard.spec.tsx`, using role/label/text queries only. Cover:
  - list rendering with name, source label and `<time>`;
  - search filtering and the `Highlight` match;
  - the default Newest order;
  - switching to Oldest and to Name A–Z through the dropdown;
  - loading, error with retry calling `onRetry`, empty and no-results states;
  - the status region text for the result count and no-results;
  - the search being inside `role="search"`;
  - no "New project" button.
  - Verification: `npm run test:file -- libs/projects/src/components/Projects/tests/Projects.spec.tsx` and `npm run test:file -- libs/projects/src/components/ProjectCard/tests/ProjectCard.spec.tsx`
- [x] 3.9 Export the public API from `libs/projects/src/index.ts`: `Projects`, `ProjectSource`, `ProjectsSortKey`, and the `ProjectItem`/`ProjectsLabels`/`ProjectsProps`/`ProjectsStyles` types. Add `./styles.css` to `exports` only if the lib ships an SCSS module, per `.claude/rules/libs.md` "The stylesheet export". If a public `dial-*` class is added, document it in the README class table.
- [x] 3.10 Architecture guard: run `grep -rnE "/api/|ai-dial-chat-api-client|server-api|useFeatureFlag|react-router|react-i18next|process\.env|localStorage" libs/projects/src` and expect no matches.
- [x] 3.11 Slice check: `npm run verify:changed`.

## 4. App page, data hook and i18n

- [x] 4.1 Add the i18n keys to `apps/chat/src/i18n/locales/en.json`:
  - the `projects` namespace, with the `page.*`, `toolbar.*`, `emptyState.*` ("No projects yet" / "Your projects will appear here once created."), `noResults.label`, `error.label`, `status.resultCount_one`/`_other`, `source.*` and `card.updatedAt` keys;
  - `navigation.projects` ("Projects").

  Add the `ProjectsI18nKeys` enum and `NavigationI18nKeys.Projects = 'navigation.projects'` to `apps/chat/src/constants/translation-keys.ts`. Reuse `ButtonsI18nKeys.Sort` and `ButtonsI18nKeys.Retry`, with no duplicate keys.
- [x] 4.2 Add `mapProjectDtoToItem` in `apps/chat/src/utils/map-project-dto.ts`. It maps the generated `ProjectSource` onto the lib's `ProjectSource` and sets `updatedAt` from `updatedAt ?? createdAt`. Unit-test it in `apps/chat/src/utils/tests/map-project-dto.spec.ts`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/map-project-dto.spec.ts`
- [x] 4.3 Implement `useProjects(enabled)` in `apps/chat/src/hooks/projects/useProjects.ts`, with JSDoc on why it exists, following the `useFavicon` pattern:
  - `AbortController` in `useEffect`, async/await, and no state set after abort;
  - no request while `enabled` is false;
  - returns `{ projects, isLoading, hasError, retry }`, where `retry` is a stable `useCallback` that bumps a reload token.

  Unit-test it in `apps/chat/src/hooks/projects/tests/useProjects.spec.ts`. Cover success, error then retry, abort on unmount, and `enabled=false` sending no request.
  - Verification: `npm run test:file -- apps/chat/src/hooks/projects/tests/useProjects.spec.ts`
- [x] 4.4 Add `Projects = '/projects'` to `ROUTES` in `apps/chat/src/types/routes.ts`. Implement `apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`:
  - `useFeatureFlag('projectsEnabled')`; when not true, render `NotFoundPage` and call `useProjects(false)`;
  - `useState` for `searchQuery` and `sortKey`, defaulting to `ProjectsSortKey.Newest`;
  - `labels` built with `useMemo` from `t()`;
  - `formatUpdatedAt` built with `useLanguage` + `Intl.DateTimeFormat` and wrapped in `projects.card.updatedAt`;
  - `locale` passed to the lib;
  - handlers in `useCallback`.

  Register it in `apps/chat/src/app/app.tsx` as a `lazy` page inside `RouteErrorBoundary` + `Suspense` + `RouteFallback`, using an async loader that returns the default export.
- [x] 4.5 Write the page test in `apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx`, mocking `server-api/projects.api`. Cover:
  - flag off renders the NotFound content and does not call `listProjects`;
  - flag on renders the loaded projects with translated source labels and formatted dates;
  - typing in the search filters the list;
  - error, then retry, reloads.
  - Verification: `npm run test:file -- apps/chat/src/pages/ProjectsPage/tests/ProjectsPage.spec.tsx`
- [x] 4.6 Slice check: `npm run verify:changed`.

## 5. Navigation entry

- [x] 5.1 Insert the Projects entry into `NAVIGATION_CONFIG` in `apps/chat/src/constants/navigation.ts`, directly after the `ROUTES.Root` entry: `path: ROUTES.Projects`, `icon: IconBriefcase`, `activeIcon: IconBriefcaseFilled`, `labelKey: NavigationI18nKeys.Projects`, `featureFlag: 'projectsEnabled'`.
- [x] 5.2 Extend the existing navigation tests: the `SidebarNavigation` spec under `apps/chat/src/components/Navigation/` and the `useVisibleNavItems` spec next to `apps/chat/src/hooks/useVisibleNavItems.ts`. Cover:
  - the Projects item is hidden when `projectsEnabled` is off;
  - it is shown directly after New chat when the flag is on;
  - it is `aria-current="page"` on `/projects`.

  Also check the mobile navigation bottom sheet, which renders from the same config.
  - Verification: `npm run test:file -- <the SidebarNavigation spec path>` and `npm run test:file -- <the useVisibleNavItems spec path>`

## 6. Documentation

- [x] 6.1 `apps/chat-api/README.md`: add the `PROJECTS_ENABLED` and `PROJECTS_ENABLED_ROLES` rows to the environment table next to the scheduled-tasks flags, and `/api/v1/projects` to "Versioned domains". The README repeats these sections several times; update every copy consistently and record the duplication as a follow-up, without cleaning it up here. Add commented `# PROJECTS_ENABLED=false` / `# PROJECTS_ENABLED_ROLES=` lines to `apps/chat-api/.env.template` under their own heading.
- [x] 6.2 `docs/architecture.md`, in the same change:
  - add `@epam/ai-dial-projects` / `projects` to the libraries table and the diagram list;
  - add `projects/` to the backend domain tree;
  - add a `/api/v1/projects` row to the controller base-path table;
  - add the `/projects` route.
- [x] 6.3 Write `libs/projects/README.md` in the standard shape: H1 = package name, Overview, Installation (+ the `styles.css` import only if exported), Peer Dependencies, Components (a `Projects` example passing every required prop), Enums, Types. The examples must compile against the real exports.
- [x] 6.4 Run `npm run docs:install-matrix` and commit the regenerated `docs/host-install-matrix.md`.
- [x] 6.5 Run `npm run validate:docs` and `npm run validate:specs`, and fix any failures.

## 7. Final verification

- [x] 7.1 `npm run build:quiet` (a new lib and a new lazy route affect bundling).
- [x] 7.2 `npm run verify:full`, run exactly once, at the end.
  - Result: typecheck, lint:check and format:check passed. test:full had 3 failures in untouched specs (`skills.controller.spec.ts`, `text-refinement.controller.spec.ts`, 404 under parallel load). Both files pass in isolation, and a full `nx test chat-api` rerun passed 5578/5578.

## 8. Follow-ups (out of scope, record only)

- [x] 8.1 Open follow-up issues for (tracked in the "Out of scope (follow-ups)" section of [#9596](https://github.com/epam/ai-dial-chat/issues/9596) for creation, the sidebar filters/tree and opening/editing/files; the partial-failure UI notice and the README dedup are not yet tracked in an issue):
  - the New project creation flow;
  - the sidebar filters (All / Personal / Shared / Organization) and the category tree;
  - opening/editing projects and project files;
  - a UI notice for partial-source failure;
  - deduplicating the repeated sections in `apps/chat-api/README.md`.
