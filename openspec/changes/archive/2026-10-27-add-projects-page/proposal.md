## Why

Users have no single place in the chat to see the DIAL projects they own, the ones shared with them, and the organization-level ones. DIAL Core already exposes project metadata (`GET /v2/metadata/projects/{bucket}/{path}`, SDK `listProjectMetadata`), and `getSharedResources` already accepts the `PROJECT` resource type, but neither the BFF nor the SPA uses them. This page is the entry point for the upcoming project features (creation, editing, files, a category tree). Shipping it behind an off-by-default, role-restrictable flag lets us roll it out to selected roles first. Source: GitHub issue #9596.

## What Changes

- **BFF: new `projects` domain** (`apps/chat-api/src/projects/`: controller, service, mapper, `dto/`, module, registered in `app.module.ts`). It follows the `scheduled-tasks` layout (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:55-58` for the class-level `FeatureGuard` + `@RequireFeature`) and the `listCatalogSkills` aggregation (`apps/chat-api/src/skills/listing/skills-listing.service.ts:313`).
  - `GET /api/v1/projects` (`listProjects`) returns one flat, merged list built from three sources:
    - **personal**: the session user's bucket, `listProjectMetadata(bucket, '', { recursive: true })`;
    - **organization**: `PUBLIC_BUCKET`, same call;
    - **shared**: `getSharedResources({ resourceTypes: ['PROJECT'], with: 'me' })`.
  - Grouping folders are dropped. Duplicates are removed by URL (an owned or public copy wins over a shared one).
  - The bucket always comes from the session. No client-supplied bucket or path exists, so path traversal is impossible by construction.
  - The BFF walks every Core page itself (bounded page cap, repeated-cursor detection), so the response carries no `nextToken`. See design D2: this deliberately departs from the issue text.
  - If one source fails, the other sources are still returned and the failure is logged (as `listCatalogSkills` does). If every source fails, the first error is rethrown through `handleDialSdkError`.
- **Feature flag**:
  - `FeatureKey.ProjectsEnabled = 'features.projectsEnabled'`;
  - a `CONFIG_DEFINITIONS` entry (`type: 'feature'`, `visibility: 'client'`, `defaultValue: false`, `envVar: 'PROJECTS_ENABLED'`, `allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES'`);
  - the matching `EnvironmentVariables` fields;
  - documentation in `apps/chat-api/README.md` and `apps/chat-api/.env.template`.
- **Generated client**: `npm run openapi` regenerates `ProjectsApi`. The client is wired in `apps/chat/src/server-api/api-client.ts` and wrapped by `apps/chat/src/server-api/projects.api.ts`.
- **Navigation**: a **Projects** entry in `NAVIGATION_CONFIG` right after New chat, with `featureFlag: 'projectsEnabled'`, the `IconBriefcase`/`IconBriefcaseFilled` icons and the `navigation.projects` key.
- **Route**: `ROUTES.Projects = '/projects'` is registered unconditionally as a lazy page in `app.tsx`. The page itself renders `NotFoundPage` when the flag is off, as `ScheduledTasksPage` does (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx:99`).
- **New presentational lib `libs/projects` (`@epam/ai-dial-projects`)**, modeled on `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`. It contains:
  - a `Projects` page shell: title, kit `Search` inside `role="search"`, a sort `ButtonDropdown`;
  - a responsive card grid. Each card shows the name (through `Highlight`), a source badge and the last-updated date;
  - the content states: `Spinner`, error with retry, `PanelEmptyState` empty, no-results;
  - an `aria-live` status region.
  - Search and sort run client-side over the full list. Sort defaults to **Newest**; the other options are **Oldest** and **Name A–Z**.
- **App adapter** `apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`, plus a `useProjects` hook in `apps/chat/src/hooks/projects/` (fetch, cancel on unmount, retry) and a DTO→item mapper.
- **i18n**: a new `projects` namespace in `en.json` behind a `ProjectsI18nKeys` enum, plus `navigation.projects` behind `NavigationI18nKeys.Projects`.
- **Docs**: `docs/architecture.md` (new lib, backend domain, `/api/v1/projects` controller base path, `/projects` route), `apps/chat-api/README.md`, the new `libs/projects/README.md`, and the regenerated `docs/host-install-matrix.md`.

## Capabilities

### New Capabilities

- `projects-api`: the `GET /api/v1/projects` BFF endpoint. Covers source aggregation (personal/organization/shared), mapping and dedup, Core paging, partial failure, the feature guard and the OpenAPI contract.
- `projects-page-ui`: the flag-gated `/projects` page and the host-agnostic `@epam/ai-dial-projects` lib. Covers search with highlight, client-side sort, content states, i18n, responsive/RTL/a11y requirements and the lib isolation boundary.

### Modified Capabilities

- `feature-flags-service`: the `FeatureKey` enum gains `ProjectsEnabled`.
- `navigation-routing`: the top-level route list gains `ROUTES.Projects`. `NAVIGATION_CONFIG` gains the flag-gated Projects entry right after New chat.

## Non-goals

- Creating a project. The **New project** button from the mockup is **not rendered** in this iteration.
- The secondary sidebar (All / Personal / Shared / Organization filters) and the hierarchical category tree.
- Opening or editing a project, and project files. Cards are not links yet.
- Server-side search/sort or a paginated contract. Revisit if real project counts make a full listing too costly.
- A `chat-hooks` data hook. The data hook stays app-level until a second host needs it.

## Alternatives considered

- **UI location**: new `libs/projects` (chosen) vs app-only components. The lib costs a manifest, a README and an install-matrix entry now. It was chosen because the feature will grow (sidebar, tree, editor), and that matches every other domain page (`libs/scheduled-tasks`, `libs/catalog`).
- **Paging contract**: full server-side aggregation (chosen) vs a pass-through `nextToken`. Three sources, one of them unpaginated (`getSharedResources`), cannot share one opaque cursor. Client-side sort by date or name and search are also only correct over the full set. Details are in design D2.
- **Scope of sources**: personal + shared + organization was chosen over personal-only, per the product decision on this change.

## Acceptance criteria

- With `PROJECTS_ENABLED=false` (the default), all three hold:
  - no Projects nav item is rendered;
  - `/projects` renders NotFound and sends no projects request;
  - `GET /api/v1/projects` is rejected by `FeatureGuard` with 403.
- With the flag on, optionally limited by `PROJECTS_ENABLED_ROLES`, the nav item and page appear. The page lists the user's personal, shared and organization projects from DIAL Core, each showing its source.
- BFF unit tests cover:
  - the happy path and multi-page Core paging, including the page cap and a repeated cursor;
  - dedup and folder filtering;
  - partial and total source failure, and each upstream error mapping;
  - guard rejection, and that the bucket comes only from the session.
- Frontend tests cover list rendering, search with `Highlight`, the three sort orders, and the loading, error/retry, empty and no-results states.
- The layout is mobile-first with `mobile`/`desktop` variants and no horizontal page scroll.
- RTL uses logical properties only.
- a11y meets WCAG 2.1 AAA:
  - the search is inside `role="search"`;
  - the result count and the no-results feedback go through `aria-live`;
  - decorative icons are `aria-hidden`;
  - Tabler icons use `stroke={DIAL_KIT_ICON_STROKE}`.
- `libs/projects` contains no REST paths, flags, i18n or routing. Every string and callback comes from the host.
- `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass.

## Impact

- **Backend**:
  - new domain `apps/chat-api/src/projects/`;
  - `app.module.ts`;
  - `feature-key.enum.ts`;
  - `config-registry.constants.ts`;
  - `environment.config.ts`;
  - the OpenAPI spec and the regenerated `libs/chat-api-client`.
- **Frontend**:
  - `api-client.ts` and the new `projects.api.ts`;
  - `types/routes.ts`, `app/app.tsx` and `constants/navigation.ts`;
  - `translation-keys.ts` and `en.json`;
  - the new page, hook and mapper.
- **New lib** `libs/projects`, which needs:
  - `tsconfig.base.json` paths;
  - an `apps/chat/tsconfig.app.json` reference;
  - a source alias in `apps/chat/vite.config.mts` and the workspace link from `npm install`.
  - Scope note: this is a new shared lib. It depends only on `@epam/ai-dial-chat-shared` (`PanelEmptyState`, `buildCssVars`, `mergeClasses`) and `@epam/ai-dial-ui-kit`. It touches no global provider and no existing lib.
- **i18n**: about 20 new user-visible strings (page title, subtitle, search, sort options, the states, source labels and the updated-date label), all in English `en.json` only.
- **Rollback / compatibility**: purely additive and off by default. No existing endpoint, DTO or route changes. To revert, leave `PROJECTS_ENABLED` unset or revert the commit. There is no persisted state or migration.
