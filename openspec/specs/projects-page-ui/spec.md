# projects-page-ui Specification

## Purpose

The flag-gated `/projects` page and the host-agnostic `@epam/ai-dial-projects` lib: data ownership in the app, search with highlight, client-side sort, content states, i18n, and the mobile-first, RTL and WCAG 2.1 AAA requirements.

## Requirements

### Requirement: Projects page renders behind the projectsEnabled flag

The application SHALL register `ROUTES.Projects` (`/projects`) in `apps/chat/src/app/app.tsx` as a lazy-loaded `ProjectsPage` (`apps/chat/src/pages/ProjectsPage/ProjectsPage.tsx`), using the `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper. The route is registered unconditionally. The page SHALL read `useFeatureFlag('projectsEnabled')` and render `NotFoundPage` (`apps/chat/src/pages/NotFound/NotFound.tsx`) when the flag is not `true`. This is the same guard `ScheduledTasksPage` applies (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`).

**Feature flag:** `projectsEnabled` (registry key `features.projectsEnabled`, default `false`, role restriction via `PROJECTS_ENABLED_ROLES`). **RTL impact:** see the RTL requirement. **i18n impact:** see the i18n requirement.

#### Scenario: Flag on renders the page

- **WHEN** `projectsEnabled` is `true` and the user navigates to `/projects`
- **THEN** the lazy-loaded `ProjectsPage` mounts and renders the `Projects` lib component

#### Scenario: Flag off renders NotFound without requesting projects

- **WHEN** `projectsEnabled` is not `true` and the user navigates directly to `/projects`
- **THEN** the page renders the `NotFound` content, and `ProjectsApi.listProjects` is not called

#### Scenario: Page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/projects`
- **THEN** neither `ProjectsPage` nor `@epam/ai-dial-projects` is in the initial bundle

### Requirement: The app owns project data through useProjects

Data state SHALL be owned by the `useProjects(enabled: boolean)` hook (`apps/chat/src/hooks/projects/useProjects.ts`, one hook per file, with JSDoc on why it exists). No new React context is introduced, because only the page consumes the data.

The hook calls `listProjects({ signal })` from `apps/chat/src/server-api/projects.api.ts`. That wrapper calls `projectsApi.listProjects(...)` on the `ProjectsApi` instance exported from `apps/chat/src/server-api/api-client.ts`; no `fetch` and no `base.ts` helper is used. The hook maps each `ProjectDto` through `mapProjectDtoToItem` (`apps/chat/src/utils/map-project-dto.ts`), which maps `ProjectSource` onto the lib's `ProjectSource`.

The hook returns `{ projects, incompleteSources, isLoading, hasError, retry }`:

- It fetches inside `useEffect` with an `AbortController`, and aborts on unmount or when `enabled` turns false. A cancelled request never sets state.
- `isLoading` is derived, not stored: it is `true` whenever `enabled` is `true` and no result answers the current reload token. An enabled page is therefore loading from its first enabled render, including the render where the app config first becomes ready, and never momentarily shows the empty state.
- `retry` is a stable `useCallback` that re-runs the fetch.
- While `enabled` is `false`, the hook sends no request.

#### Scenario: Successful load populates the list

- **WHEN** the page mounts with the flag on and `listProjects` resolves with three items
- **THEN** `isLoading` goes from `true` to `false`, `projects` has three mapped items, and `hasError` is `false`

#### Scenario: The first enabled render is already loading

- **WHEN** the hook first renders with `enabled: false` (app config not ready) and then with `enabled: true`
- **THEN** every render with `enabled: true` reports `isLoading: true` until the response arrives

#### Scenario: Unmount aborts the request

- **WHEN** the page unmounts while `listProjects` is pending
- **THEN** the request's `AbortSignal` is aborted, and no state update happens after unmount

#### Scenario: Retry refetches after an error

- **WHEN** `listProjects` rejects and the user activates the retry action
- **THEN** `listProjects` is called again, and a successful second response replaces the error state with the list

### Requirement: @epam/ai-dial-projects is a host-agnostic presentational lib

A new lib `libs/projects`, published as `@epam/ai-dial-projects`, SHALL export:

- a `Projects` component, together with the `ProjectItem`, `ProjectsLabels`, `ProjectsProps` and `ProjectsStyles` types and the `ProjectSource` and `ProjectsSortKey` string enums;
- the `ProjectCreateForm` component and its types, enums and helpers, which are specified in `project-create-ui`;
- the `ProjectView` component and its types, which are specified in `project-view-ui`.

The manifest and README follow `.claude/rules/libs.md`. The lib SHALL NOT import:

- `@epam/ai-dial-chat-api-client`, or any REST path;
- feature flags, i18n, routing or app contexts.

Every host-owned decision arrives as a prop:

| Prop | Type |
| --- | --- |
| `projects` | `ProjectItem[]` |
| `isLoading` | optional `boolean`, default `false` |
| `hasError` | optional `boolean`, default `false` |
| `incompleteSources` | optional `ProjectSource[]`, default `[]` |
| `onRetry` | `() => void` |
| `onCreateProject` | optional `() => void`; when omitted, no New project button renders |
| `onOpenProject` | optional `(id: string) => void`; when omitted, cards are not interactive |
| `getProjectHref` | optional `(id: string) => string`; required whenever `onOpenProject` is supplied |
| `searchQuery` | `string` |
| `onSearchQueryChange` | `(query: string) => void` |
| `sortKey` | `ProjectsSortKey` |
| `onSortKeyChange` | `(key: ProjectsSortKey) => void` |
| `labels` | `ProjectsLabels` (adds optional `createProjectLabel`, required whenever `onCreateProject` is supplied, and `pinnedLabel`) |
| `locale` | optional `string` |
| `styles` | optional `ProjectsStyles`, applied via `buildCssVars` |

`ProjectItem` is `{ id: string; name: string; source: ProjectSource; parentPath?: string; updatedAt?: number; isPinned?: boolean }`.

- The app mapper copies `parentPath` from `ProjectDto.parentPath`, and sets `updatedAt` from `updatedAt ?? createdAt`. `updatedAt` drives the date sort orders and is shown on the card as a relative time.
- `ProjectsPage` sets `isPinned` in a `useMemo`, from the `pinnedProjectIds` of `useUserConfig()`.
- `ProjectsPage` passes `onOpenProject={(id) => navigate(getProjectViewRoute(id))}` and `getProjectHref={getProjectViewRoute}`, both memoised.

Every declared prop SHALL be read. Search and sort state is controlled by the app page, so `ProjectsPage` holds `searchQuery` and `sortKey` in `useState`, with `ProjectsSortKey.Newest` as the initial value. Neither is persisted.

#### Scenario: Lib receives resolved strings, not translation keys

- **WHEN** `ProjectsPage` renders `<Projects />`
- **THEN** every `labels` value is a string already resolved by `useTranslation().t()`, and the lib source contains no `react-i18next` import

#### Scenario: Lib has no host integration knowledge

- **WHEN** `libs/projects/src` is searched for `/api/`, `@epam/ai-dial-chat-api-client`, `useFeatureFlag` and `react-router`
- **THEN** none of them occurs

#### Scenario: Pinned flag comes from the user config

- **WHEN** `pinnedProjectIds` contains `projects/a1b2c3/q4` and the listing returns that project
- **THEN** the `ProjectItem` passed to `Projects` has `isPinned: true`

### Requirement: Search filters by project name and highlights the match

The lib SHALL filter `projects` client-side to those whose `name` contains the trimmed `searchQuery`, case-insensitively. Each card SHALL render the name with `Highlight` from `@epam/ai-dial-ui-kit`, passing `query={trimmedQuery}` and `maxLines={2}`. The search input SHALL be the kit `Search` component, inside a `<div role="search">`, with `labels.searchAriaLabel` as its accessible name and `labels.clearSearchLabel` on its clear action.

#### Scenario: Typing filters and highlights

- **WHEN** projects `Q4 Launch`, `Handbook` and `Launch retro` are listed and the user types `launch`
- **THEN** only `Q4 Launch` and `Launch retro` are rendered, and the `Launch` substring of each name is rendered through `Highlight`

#### Scenario: Whitespace-only query does not filter

- **WHEN** the search query is `"   "`
- **THEN** every project is rendered, and nothing is highlighted

### Requirement: Sort defaults to Newest and offers Oldest and Name A–Z

The lib SHALL expose `ProjectsSortKey` (`Newest = 'newest'`, `Oldest = 'oldest'`, `NameAsc = 'name-asc'`) through a kit `ButtonDropdown`:

- The dropdown uses the `IconArrowsSort` trigger icon.
- The trigger's accessible name is the applied option's label, falling back to `labels.sortLabel` for an unknown key.
- The trigger sits inside a `role="group"` whose accessible name is `labels.sortLabel`.
- `labels.sortOptions` lists the options, and the applied option is marked with `MenuItemMark`, following `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`.

Sorting applies after filtering. Pinned projects (`isPinned: true`) come before unpinned ones in every order. Within each group:

- **Newest**: by `updatedAt`, descending.
- **Oldest**: by `updatedAt`, ascending.
- **Undated projects**: in both date orders, items without `updatedAt` come last.
- **Name A–Z**: by `name`, using `Intl.Collator(locale, { sensitivity: 'base', numeric: true })`.
- **Ties**: in date orders, ties are broken by name with the same collator.

#### Scenario: Default order is Newest

- **WHEN** the page first renders unpinned projects updated at t=1, t=3 and t=2
- **THEN** the cards render in the order t=3, t=2, t=1, and the sort control shows Newest as applied

#### Scenario: Oldest reverses the date order and keeps undated last

- **WHEN** the user selects Oldest for unpinned projects updated at t=2, undated, and t=1
- **THEN** the order is t=1, t=2, then the undated project

#### Scenario: Name A–Z orders by collator

- **WHEN** the user selects Name A–Z for unpinned `beta`, `Alpha` and `alpha 10`
- **THEN** the order is `Alpha`, `alpha 10`, `beta`

#### Scenario: Pinned projects sort first

- **WHEN** projects `a` (t=3), `b` (t=1, pinned) and `c` (t=2, pinned) are listed under Newest
- **THEN** the order is `c`, `b`, `a`

### Requirement: Each project card shows its name and folder path

The lib SHALL render the visible projects as a list (`<ul>` with one `<li>` per project), keyed by `id`. Each card is the kit `CardShell` (an `<article>` with the design's radius, padding and shadow), named by the project name through `aria-label`. It shows, top to bottom with an 8px gap:

- when `updatedAt` is set, the last-updated time relative to the page visit, in a `<time>` element whose `dateTime` is the ISO timestamp, formatted with `Intl.RelativeTimeFormat(locale)` in the largest whole unit (e.g. `49 minutes ago`, `1 week ago`; under a minute reads `now`);
- the name, through `Highlight` with `maxLines={1}`;
- when `isPinned`, an `IconPinFilled` marker (`aria-hidden`) followed by visually hidden `labels.pinnedLabel` text, on the inline end of the name row;
- the kit `FolderPath`, with no divider above it, named by `labels.folderPathLabel`, whose segments are `labels.sourceLabels[source]` followed by the `/`-separated `parentPath` folders.

No description or source badge is rendered: the listing carries no description, and the design shows the source only in the folder path.

**Interactive cards.** When `onOpenProject` and `getProjectHref` are supplied, the name SHALL be an `<a href={getProjectHref(id)}>`. Its `::after` is stretched over the card, so the whole card is the click target, while the link remains the single tab stop. A primary click without modifier keys calls `event.preventDefault()` and then `onOpenProject(id)`. A modified or middle click follows the `href`, so the project opens in a new tab. Hover and `:focus-visible` apply the same card highlight: the kit `CardShell` lift with `shadow-lg` (none under `prefers-reduced-motion`), plus a focus outline in `--stroke-focus` on `:focus-visible`. The card background does not change.

Without those props, cards are not interactive: no link, button or `tabIndex`.

The **New project** buttons are specified separately, in "Projects page offers New project in the header and the empty state".

**RTL impact:** the pin marker sits at the inline end through logical properties, and it is not mirrored. **i18n impact:** `projects.card.pinned` ("Pinned").

#### Scenario: Card content

- **WHEN** a project `{ name: 'Handbook', source: ProjectSource.Organization, updatedAt: 1789000000000 }` is rendered
- **THEN** its card is an `<article>` named `Handbook` that shows a `<time>` element with the relative last-updated time, the name, and a folder path containing only the organization source label

#### Scenario: Undated card has no time

- **WHEN** a project has no `updatedAt`
- **THEN** its card renders no `<time>` element

#### Scenario: Nested project shows its folders

- **WHEN** a project has `source: ProjectSource.Personal` and `parentPath: 'marketing/2026'`
- **THEN** its folder path reads Personal, then `marketing`, then `2026`

#### Scenario: Clicking a card opens the project

- **WHEN** the user clicks the `Handbook` card on the Projects page
- **THEN** `onOpenProject('projects/public/handbook')` is called, and the router is at `/projects/view/public/handbook`

#### Scenario: Card link supports a new tab

- **WHEN** the user Ctrl+clicks or middle-clicks the card
- **THEN** `onOpenProject` is not called, and the link's `href` is `/projects/view/public/handbook`

#### Scenario: Pinned card is marked

- **WHEN** a project has `isPinned: true`
- **THEN** its card contains the text "Pinned", available to assistive technology

### Requirement: Projects page has explicit loading, error, empty and no-results states

The lib SHALL render exactly one content state at a time:

- **Loading** (`isLoading`): the kit `Spinner`.
- **Error** (`hasError && !isLoading`): `labels.errorLabel` with a retry button labelled `labels.retryLabel` that calls `onRetry`.
- **Incomplete and empty** (`incompleteSources` non-empty and no projects): `labels.incompleteLabel` with the same retry button, instead of the empty state, so a degraded answer never claims there are no projects.
- **Empty** (no projects, every source complete): `PanelEmptyState` from `@epam/ai-dial-chat-shared` with `labels.emptyStateLabel` ("No projects yet") and `labels.emptyStateDescription` ("Your projects will appear here once created."), at the top of the content area.
- **No results** (projects exist but the search matches none): a separate `PanelEmptyState` with `labels.noResultsLabel`, at the top of the content area.
- **List**: otherwise.

The title, the subtitle (when `labels.subtitle` is set) and the toolbar (search + sort) stay rendered in every state. Loading, error and incomplete-and-empty states are centred in the content area. When `incompleteSources` is non-empty and projects are listed, a notice with `labels.incompleteLabel` and the retry button renders above the list or the no-results state.

#### Scenario: Loading state

- **WHEN** `isLoading` is `true`
- **THEN** a `Spinner` is rendered, and no card, empty state or error is rendered

#### Scenario: Error state with retry

- **WHEN** `hasError` is `true` and `isLoading` is `false`
- **THEN** the error label and a retry button are rendered, and activating the button calls `onRetry` once

#### Scenario: Empty state

- **WHEN** `projects` is empty and there is no error
- **THEN** `PanelEmptyState` shows "No projects yet" with "Your projects will appear here once created."

#### Scenario: Incomplete sources never show the empty state

- **WHEN** `projects` is empty and `incompleteSources` is `[ProjectSource.Personal]`
- **THEN** the incomplete label and a retry button are rendered, and neither "No projects yet" nor its description is rendered

#### Scenario: Incomplete sources add a notice above the list

- **WHEN** projects are listed and `incompleteSources` is non-empty
- **THEN** the cards render, and a notice with the incomplete label and a retry button renders above them

#### Scenario: No-results state is distinct from empty

- **WHEN** projects exist but none matches the query
- **THEN** the no-results state is rendered, and the empty state is not

### Requirement: Projects UI strings flow through react-i18next

Every user-visible string SHALL be resolved in `ProjectsPage` with `useTranslation().t()` and passed to the lib as a plain string. The keys live in a new `projects` namespace in `apps/chat/src/i18n/locales/en.json` and are referenced through a `ProjectsI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`:

- `projects.page.title` ("All projects")
- `projects.toolbar.searchPlaceholder`
- `projects.toolbar.searchAriaLabel`
- `projects.toolbar.sortNewest`
- `projects.toolbar.sortOldest`
- `projects.toolbar.sortNameAsc`
- `projects.emptyState.label`
- `projects.emptyState.description`
- `projects.noResults.label`
- `projects.error.label`
- `projects.incomplete.label`
- `projects.status.resultCount` (with `{{count}}` plural forms)
- `projects.source.personal`
- `projects.source.shared`
- `projects.source.organization`
- `projects.card.folderPath` ("Project location", the folder path's accessible name)

The sort control label reuses `ButtonsI18nKeys.Sort`, the retry label reuses `ButtonsI18nKeys.Retry`, and the clear-search label reuses `BasicI18nKeys.ClearSearch`, instead of new `projects.*` keys. The nav label key `navigation.projects` is specified in `navigation-routing`. The former `projects.card.updatedAt` key stays removed: the card's relative time comes from `Intl.RelativeTimeFormat`, not a translation. The former `projects.page.subtitle` key is removed; the design shows no page description, so `ProjectsPage` passes no `labels.subtitle`.

#### Scenario: Keys exist in en.json

- **WHEN** the change is applied
- **THEN** every `projects.*` key listed above exists in `en.json` and in `ProjectsI18nKeys`
- **AND** the keys `projects.page.subtitle`, `projects.toolbar.sortLabel`, `projects.toolbar.clearSearchLabel`, `projects.error.retry` and `projects.card.updatedAt` SHALL NOT exist

### Requirement: Projects page is mobile-first, RTL-safe and meets WCAG 2.1 AAA

The Projects lib and page SHALL meet the layout, RTL, accessibility and memoisation rules below.

**Layout:**

- The lib layout SHALL be mobile-first. Cards use one column by default and, under the `desktop:` variant from `tools/tailwind/theme.css`, three columns with a 20px gap in a centred grid at most 1116px wide.
- The header, the toolbar and the content area have 16px inline padding on mobile and 32px under `desktop:`; the header has 16px block padding, the toolbar 16px above and 20px below, and the content area 24px above.
- No `sm:`/`md:`/`lg:`/`xl:` prefixes are used.
- Long names truncate to one line with a tooltip, and the folder path collapses or truncates inside the card, so the page never scrolls horizontally at a 320 px viewport.
- On `mobile`, the toolbar stacks the search above the sort control.

**RTL:**

- Only logical properties are used (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`, `border-s-*`).
- The folder path's separators come from the kit `FolderPath`; the page adds no directional icon of its own (`IconArrowsSort` is symmetric).
- Direction is inherited from `<html dir>`. The lib does not read the language.

**Accessibility:**

- The title is the page's `<h1>`.
- The search is inside `role="search"`.
- Each card is an `<article>` named by its project, and its folder path is a `<nav>` named by `labels.folderPathLabel`.
- A visually hidden `<span role="status" aria-live="polite">` announces each of these states:
  - the result count (`projects.status.resultCount`);
  - the no-results label;
  - the empty-state label;
  - the error label;
  - the incomplete label, which takes precedence over the result count.
  It announces nothing while loading.
- Every Tabler icon passes `stroke={DIAL_KIT_ICON_STROKE}`. Decorative icons, including icons inside labelled controls, carry `aria-hidden`.
- The sort dropdown and the retry button are reachable and operable by keyboard.
- Text colors use theme tokens whose fallbacks meet a 7:1 contrast ratio.

**Memoisation:**

- The lib computes the filtered and sorted list in `useMemo`, keyed on `projects`, `searchQuery`, `sortKey` and `locale`.
- `ProjectsPage` memoises `labels` with `useMemo` and its handlers with `useCallback`.

#### Scenario: Status region announces result count

- **WHEN** a search leaves 2 of 5 projects visible
- **THEN** the `aria-live` status region text is the localized "2 projects"

#### Scenario: Status region announces no results

- **WHEN** a search matches no project
- **THEN** the status region text equals `labels.noResultsLabel`

#### Scenario: Narrow viewport has no horizontal scroll

- **WHEN** the page renders at a 320 px wide viewport with a 120-character project name
- **THEN** the document's `scrollWidth` does not exceed its `clientWidth`

#### Scenario: RTL mirrors the layout

- **WHEN** `<html dir="rtl">` is set
- **THEN** the toolbar and card content align to the inline start in RTL order, and no physical left/right class is present in the lib's source

### Requirement: Projects page offers New project in the header and the empty state

When `onCreateProject` is supplied, the `Projects` lib component SHALL render two **New project** buttons, both labelled `labels.createProjectLabel` and both calling `onCreateProject`:

- **Header button:** a primary kit `Button` without an icon, on the inline end of the title row. It is rendered in every content state.
- **Empty-state button:** a secondary kit `Button` without an icon, passed as the `action` of the empty-state `PanelEmptyState`, so it renders only in the Empty state. It does not render in the no-results, error or incomplete states.

When `onCreateProject` is omitted, neither button renders.

`ProjectsPage` passes `onCreateProject={() => navigate(ROUTES.ProjectCreate)}` (memoised with `useCallback`), and resolves `labels.createProjectLabel` from `projects.page.newProject` ("New project"). On `mobile`, the header button stays visible next to the title. The title wraps before the button is pushed out, and the page never scrolls horizontally at 320 px.

**Feature flag:** inherits `projectsEnabled` from the page. **RTL impact:** the button sits at the inline end through logical properties. **i18n impact:** `projects.page.newProject`.

#### Scenario: Header button navigates to the create page

- **WHEN** projects are listed and the user activates the header **New project** button
- **THEN** `onCreateProject` is called once, and the router navigates to `/projects/new`

#### Scenario: Empty state has its own New project button

- **WHEN** there are no projects and every source is complete
- **THEN** the empty state shows "No projects yet", its description, and a **New project** button, and the header button is also present

#### Scenario: No buttons without the callback

- **WHEN** `Projects` renders without `onCreateProject`
- **THEN** no button named "New project" is rendered
