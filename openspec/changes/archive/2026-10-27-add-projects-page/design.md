## Context

DIAL Core stores projects as complex resources under `/v2/metadata/projects/{bucket}/{path}`. `@epam/ai-dial-typescript-sdk` (0.2.0-dev.15) already exposes `listProjectMetadata(bucket, path, { params: { query: { token, limit, recursive } } })`. Its response type is `ResourceFolderMetadata | ComplexResourceItemMetadata`: items carry `name`, `bucket`, `parentPath`, `url`, `author`, `createdAt`, `updatedAt`, `permissions` and an `attributes` map, and they have no `description`. `getSharedResources` accepts `resourceTypes: ['PROJECT']`.

Nothing in `apps/chat-api` or `apps/chat` uses either call today.

The closest existing shapes are:

- `SkillsListingService.listCatalogSkills` (`apps/chat-api/src/skills/listing/skills-listing.service.ts`): personal + `PUBLIC_BUCKET` + shared aggregation, using `allSettled`, bounded paging and dedup by URL. This is the model for the service.
- `ScheduledTasksController` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`): class-level `FeatureGuard` + `@RequireFeature`, and the domain layout. This is the model for the controller and module.
- `ScheduledTasks` (`libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`) with its app adapter `ScheduledTasksPage`: a presentational shell that takes labels and callbacks, kit `Search` inside `role="search"`, a `ButtonDropdown` sort, `PanelEmptyState`, and an `aria-live` status. This is the model for the lib and the page.

Product decisions taken for this change, answering the open questions in issue #9596:

- Sources are personal, shared and organization.
- The listing is recursive and flattened, with folders dropped.
- The **New project** button is hidden.
- The UI lives in a new `libs/projects` lib.

## Goals / Non-Goals

**Goals:**

- One BFF call that returns every project the user can see, each tagged with its source.
- A flag-gated page with search, sort and the four content states, meeting the mobile-first, RTL and WCAG AAA bars.
- A presentational lib with no host knowledge, ready to grow a sidebar or tree later.

**Non-Goals:**

- Project creation, opening or editing, project files.
- The sidebar filters and the category tree.
- Server-side search, sort or paging.
- A `chat-hooks` data hook. The hook stays in the app until a second host needs it.
- Persisting the sort or search choice.

## Decisions

### D1 — Aggregate three sources in the BFF, modeled on `listCatalogSkills`

`ProjectsService.listProjects(bucket, at)` runs `Promise.all([Promise.allSettled([listAll(bucket), listAll(PUBLIC_BUCKET)]), listShared(at)])`. It then:

- tags each item with its source;
- de-duplicates by `id` with personal > organization > shared precedence;
- rethrows the personal error only when both bucket listings rejected.

The shared listing swallows its own errors into `[]` with a warning, as `listSharedSkills` does.

- *Alternative: the SPA calls three endpoints.* Rejected. It moves Core aggregation knowledge into the browser, adds round-trips, and splits the error semantics.
- *Alternative: extract a generic "complex resource catalog" helper shared with skills.* Rejected for now. The skills code carries skill-specific mapping (description attribute, folder URLs), and a premature abstraction would couple two domains. Revisit when a third complex resource needs the same aggregation.

### D2 — Walk Core's cursor server-side; the response has no `nextToken`

The issue asks for a `nextToken`. With three sources, one of which (`getSharedResources`) is not paginated, a single opaque cursor would need to encode per-source state. Client-side sort (Newest, Oldest, Name) and search are also only correct over the complete set, so a partial page would sort wrongly.

The BFF therefore follows each bucket's cursor (`limit: 1000`, at most `MAX_UPSTREAM_PAGES_PER_SOURCE = 20` pages, so up to 20 000 projects per source) and returns the full list. A repeated cursor fails that source with 502, as in `listAllSkillItems`. Reaching the cap logs a warning and returns what was collected.

- *Alternative: a composite base64 cursor `{ personal?, organization?, sharedDone }`.* Rejected. It adds complexity, and the client still cannot sort before it has every page.
- *Alternative: pass Core's cursor through for the personal bucket only.* Rejected. Organization and shared items would have no paging story.
- Trade-off: the payload grows with the project count. The cap bounds the worst case, and the contract can gain paging later as an additive change (an optional `nextToken`).

### D3 — An empty bucket's 404 means "no projects", not a failure

Core documents `404 Grouping folder not found` for `listProjectMetadata`. A user who has never created a project may have no `projects/{bucket}/` root, and treating that as an error would turn every first visit into a degraded response. The bucket walker therefore maps a 404 on the root page to `[]` before `handleDialSdkError` runs. A 404 on a later page (a cursor that went stale mid-walk) still fails that source.

*Verified against the SDK OpenAPI only (task 1.1); no dev Core was reachable from the implementation environment.* `@epam/ai-dial-typescript-sdk` 0.2.0-dev.15 documents `listProjectMetadata` responses `200`, `400` (limit out of range), `403`, `404` ("Grouping folder not found") and `500`. Whether a never-used bucket root answers 404 or 200 with empty `items` is not stated. The walker handles both, and the tests cover both.

### D4 — Recursive listing, folders dropped

`recursive: true` returns the whole subtree. The mapper keeps only `nodeType === 'ITEM'`. `path` is `parentPath/name`, and `id` is `projects/{bucket}/{path}`, rebuilt from identity fields rather than trusting `url`, because complex-resource URLs may end in `/` (see the comment in `mapToSkillMetadataItem`). `parentPath` is kept in the DTO so the future category tree needs no contract change.

*Verified against the SDK OpenAPI only (task 1.1).* `getSharedResources` returns `SharedResourcesResponse.resources: MetadataBase[]`, and `ResourceTypes` includes `PROJECT`. The SDK does not document the URL prefix. `projects/{bucket}/{path}` is inferred from the metadata route `/v2/metadata/projects/{bucket}/{path}` and from the identical `skills/{bucket}/{path}` shape that `listSharedSkills` already parses in production. The shared mapper drops anything else rather than guessing. Re-check against a live Core before the flag is enabled for users.

### D5 — No query DTO, and no client-supplied bucket or path

The endpoint takes no parameters, so path traversal is impossible by construction, not by validation. The issue's "query DTO with class-validator" requirement is therefore covered by a test asserting that query-string values never reach the service. When a later change adds `path` (tree drill-down) or `search`, it must add a `ListProjectsQueryDto` with an allowlist `@Matches` and reuse `encodeDialResourcePath`.

### D6 — No server cache; `Cache-Control: private, no-store`

The listing is per user and changes whenever a project is created or shared. A TTL cache would show stale data right after those writes, and this iteration has no write endpoint that could invalidate it. The frontend fetches once per page mount, plus explicit retry. Revisit with a `projects:list:<sub>` key if latency becomes an issue.

### D7 — Timeout is a module constant, not a new env var

Each Core call uses `AbortSignal.timeout(PROJECTS_LISTING_TIMEOUT_MS)` with a 30 000 ms constant in `apps/chat-api/src/projects/`. Adding `PROJECTS_LISTING_TIMEOUT_MS` to `EnvironmentVariables` is deferred until an operator needs to tune it, to keep the env surface minimal. The two flag variables remain the only new env vars.

### D8 — New presentational lib `@epam/ai-dial-projects`

The lib mirrors `libs/scheduled-tasks`:

- `package.json` is `private: true`, tagged `publishable`, with a `./styles.css` export only if an SCSS module is needed. Tailwind utilities are preferred, so the export may be unnecessary.
- `react` and `@epam/ai-dial-ui-kit` are peers, at the same ranges as the scheduled-tasks lib.
- `@epam/ai-dial-chat-shared` is a peer, for `PanelEmptyState`, `buildCssVars` and `mergeClasses`.
- `@tabler/icons-react` is a dependency, at the same range.
- `tsconfig.base.json` paths are added, plus references from the root `tsconfig.json` and `apps/chat/tsconfig.app.json`, and a source alias in `apps/chat/vite.config.mts`. `npm install` links the workspace package. `apps/chat/package.json` is not changed: it lists no workspace libs.
- `npm run docs:install-matrix` regenerates `docs/host-install-matrix.md`.

The host/lib boundary:

| Concern | Owner | Carried by |
| --- | --- | --- |
| REST call, generated client | app (`server-api/projects.api.ts`) | resolved `ProjectItem[]` |
| Feature flag | app (`ProjectsPage`) | the page renders `NotFound` instead of the lib |
| Strings | app (`useTranslation`) | `labels: ProjectsLabels` |
| Date/locale formatting | app (`useLanguage` + `Intl.DateTimeFormat`) | `formatUpdatedAt`, `locale` |
| Search/sort state | app (`useState`) | controlled `searchQuery`/`sortKey` + callbacks |
| Filter/sort algorithm, rendering, a11y | lib | — |

The filter and sort run inside the lib, in `useMemo`, because they are pure presentation over the given list and every host would reimplement them identically. They are exported as pure helpers (`filterProjects`, `sortProjects`) only if a test or a host needs them. The default is not to export them.

- *Alternative: app-only components.* Rejected per the product decision. The lib's fixed cost (README, manifest, install matrix) is paid once, and the coming sidebar and tree would otherwise force a later move.

### D9 — App data hook without a context

`useProjects(enabled)` (`apps/chat/src/hooks/projects/useProjects.ts`) follows the `useFavicon` pattern: an `AbortController` in `useEffect`, async/await, a cancelled guard, and a stable `retry` built from a `reloadToken` counter. Only `ProjectsPage` consumes the data, so a context would add a provider to the global stack for nothing.

### D10 — Navigation entry and icon

The entry is placed right after New chat, per the mockup. `IconBriefcase` / `IconBriefcaseFilled` are Tabler outline/filled pairs, so no custom SVG in `constants/icons/filled-icons.tsx` is needed. The label key is `navigation.projects`, as the issue specifies. This differs from Scheduled Tasks' `scheduledTasks.page.navLabel`, and is intentional because the nav label is generic.

*Assumption*: the mockup's icon is not prescribed. Swap it if design objects.

## Risks / Trade-offs

- [Large buckets make the payload heavy] → The page cap bounds it at 20 × 1000 per source, the cap is logged when reached, and paging can be added later without a breaking change.
- [Partial failure is silent to the user: an organization outage just shows fewer projects] → This matches the skills catalog behaviour and the warning is logged. A "some sources unavailable" banner is a candidate follow-up.
- [Core's shared `PROJECT` URL shape or empty-bucket 404 differ from the assumptions in D3/D4] → Both are verified against a dev Core in the first BFF task before the mapper tests are frozen. Malformed shared URLs are dropped, never mis-parsed.
- [`createdAt`/`updatedAt` missing on some items] → Undated items sort last in both date orders, and their cards omit the date line.
- [A new lib adds release and peer-range surface] → It copies scheduled-tasks' ranges exactly, `validate:docs` checks the manifest and README, and the install matrix is regenerated.
- [Client-side filtering on thousands of cards is slow] → The list is computed in `useMemo`. If profiling shows a problem, virtualisation is a follow-up. The expected counts are small.

## Migration Plan

Purely additive, with the flag off by default. Deploy order is irrelevant: the frontend hides the entry until the client config reports `projectsEnabled: true`. To roll out, set `PROJECTS_ENABLED=true`, optionally with `PROJECTS_ENABLED_ROLES`. To roll back, unset the flag. A code revert removes the domain, route, lib and keys, and leaves no persisted data.

## Open Questions

- Should a partial-source failure be surfaced in the UI (a banner), or stay log-only? This change keeps it log-only.
- Should organization projects be visible to everyone, or does Core's `PUBLIC_BUCKET` access control already filter them per user? This change relies on Core's own access checks.
- What should the card show beyond name, source and date? `author` is available. The DTO carries `author` so the card can add it later without an API change, but the card does not render it now.
